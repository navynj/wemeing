-- 0011: the Pool world's doors (H23).
--
-- Everything that has to happen as one act, or that a caller cannot do under
-- RLS on their own (open a pool they are not yet in, join through a token for
-- a pool they cannot read), happens here. The rules, set in the session:
--
--   * every function sets search_path, refuses a null auth.uid(), and
--     re-checks membership or the token itself — arguments are never trusted;
--   * an expired or revoked token opens nothing;
--   * invite_preview tells a would-be member the pool's name and its
--     members' initials, and nothing else;
--   * a joint splash is opened only by a current member, on a lane of that
--     pool.
--
-- Nothing here drops or alters a table.

-- ---------------------------------------------------------------------------
-- internals — not callable from the API
-- ---------------------------------------------------------------------------

create function public._require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function public._require_member(pid uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
begin
  if not exists (
    select 1 from public.pool_members
     where pool_id = pid and user_id = uid and left_at is null
  ) then
    raise exception 'not a member of this pool' using errcode = '42501';
  end if;
  return uid;
end;
$$;

-- The lane that stands for a post: the declared one, else the one its blocks
-- took most, a tie to the most recently written (features/splash/summary.ts,
-- lanesByFrequency). One rule, so a placement lands where Home draws it.
create function public._splash_lane(sid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select declared_lane_id from public.splashes where id = sid),
    (select r.category_id
       from public.ripples r
      where r.splash_id = sid
      group by r.category_id
      order by count(*) desc, max(r.created_at) desc
      limit 1)
  );
$$;

-- A valid token's pool, or null. Expired and revoked tokens are no token.
create function public._invite_pool(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select i.pool_id
    from public.pool_invites i
   where i.token = p_token
     and i.revoked_at is null
     and i.expires_at > now();
$$;

-- Replace my links in a pool. Each link is checked here, not trusted: the
-- pool lane must belong to the pool, the lane to the caller.
create function public._set_links(pid uuid, uid uuid, p_links jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  link jsonb;
  plid uuid;
  cid uuid;
begin
  if p_links is not null and jsonb_typeof(p_links) <> 'array' then
    raise exception 'links must be an array' using errcode = '22023';
  end if;

  delete from public.lane_mappings where pool_id = pid and user_id = uid;

  for link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) loop
    plid := (link ->> 'pool_lane_id')::uuid;
    cid := (link ->> 'my_category_id')::uuid;
    if cid is null then
      continue; -- "Don't connect"
    end if;
    if not exists (select 1 from public.pool_lanes where id = plid and pool_id = pid) then
      raise exception 'pool lane % is not in this pool', plid using errcode = '42501';
    end if;
    if not exists (select 1 from public.my_categories where id = cid and user_id = uid) then
      raise exception 'lane % is not yours', cid using errcode = '42501';
    end if;
    insert into public.lane_mappings (user_id, my_category_id, pool_lane_id, pool_id)
    values (uid, cid, plid, pid);
  end loop;

  -- A lane that is no longer linked stops leaking: its placements switch
  -- off (kept, so switching back on is the author's act, never a side
  -- effect of relinking).
  update public.splash_placements p
     set shared = false, updated_at = now()
    from public.splashes s
   where p.splash_id = s.id
     and s.owner_id = uid
     and p.pool_id = pid
     and p.shared
     and not exists (
       select 1 from public.lane_mappings m
        where m.user_id = uid and m.pool_lane_id = p.pool_lane_id
     );
end;
$$;

-- "Include my earlier records": every post of mine whose lane is linked is
-- placed in that pool lane. A lone block is a post of one on every surface,
-- so it gets its own post row first — the same lazy row the post page makes
-- the first time one is needed (features/splash/actions.ts).
create function public._place_history(pid uuid, uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lone record;
  sid uuid;
begin
  for lone in
    select r.id, r.created_at
      from public.ripples r
      join public.lane_mappings m
        on m.my_category_id = r.category_id and m.user_id = uid and m.pool_id = pid
     where r.author_id = uid
       and r.splash_id is null
       and r.parent_ripple_id is null
  loop
    insert into public.splashes (owner_id, title, created_at)
    values (uid, '', lone.created_at)
    returning id into sid;
    update public.ripples set splash_id = sid where id = lone.id;
  end loop;

  insert into public.splash_placements (splash_id, pool_id, pool_lane_id)
  select s.id, pid, m.pool_lane_id
    from public.splashes s
    join public.lane_mappings m
      on m.my_category_id = public._splash_lane(s.id)
     and m.user_id = uid
     and m.pool_id = pid
   where s.owner_id = uid
  on conflict (splash_id, pool_id) do nothing;
end;
$$;

revoke execute on function public._require_uid() from public, anon, authenticated;
revoke execute on function public._require_member(uuid) from public, anon, authenticated;
revoke execute on function public._splash_lane(uuid) from public, anon, authenticated;
revoke execute on function public._invite_pool(text) from public, anon, authenticated;
revoke execute on function public._set_links(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public._place_history(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_pool — step 1 and step 2 of "Open a new Pool", as one act
-- ---------------------------------------------------------------------------

-- p_lanes: [{ "name", "icon", "description", "my_category_id" | null }], in
-- order. A pool with no lane would have nowhere for anything to land.
create function public.create_pool(
  p_name text,
  p_kind public.pool_kind,
  p_lanes jsonb,
  p_include_history boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  pid uuid;
  lane jsonb;
  ord bigint;
  plid uuid;
  links jsonb := '[]'::jsonb;
begin
  if p_lanes is null or jsonb_typeof(p_lanes) <> 'array'
     or jsonb_array_length(p_lanes) not between 1 and 12 then
    raise exception 'a pool needs between 1 and 12 lanes' using errcode = '22023';
  end if;

  insert into public.pools (name, kind, visibility, owner_id)
  values (btrim(p_name), p_kind, 'private', uid)
  returning id into pid;

  insert into public.pool_members (pool_id, user_id, include_history)
  values (pid, uid, coalesce(p_include_history, false));

  for lane, ord in select * from jsonb_array_elements(p_lanes) with ordinality loop
    insert into public.pool_lanes (pool_id, name, icon, description, position)
    values (
      pid,
      btrim(lane ->> 'name'),
      nullif(btrim(coalesce(lane ->> 'icon', '')), ''),
      nullif(btrim(coalesce(lane ->> 'description', '')), ''),
      ord - 1
    )
    returning id into plid;
    links := links || jsonb_build_array(jsonb_build_object(
      'pool_lane_id', plid,
      'my_category_id', lane ->> 'my_category_id'
    ));
  end loop;

  perform public._set_links(pid, uid, links);
  if coalesce(p_include_history, false) then
    perform public._place_history(pid, uid);
  end if;

  return pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- invites
-- ---------------------------------------------------------------------------

create function public.create_invite(p_pool uuid)
returns table (token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_member(p_pool);
begin
  return query
  insert into public.pool_invites (pool_id, token, created_by)
  values (
    p_pool,
    -- 24 bytes is 32 base64 characters, no padding; made URL-safe.
    translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
    uid
  )
  returning pool_invites.token, pool_invites.expires_at;
end;
$$;

create function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  perform public._require_uid();
  select pool_id into pid from public.pool_invites where id = p_invite;
  if pid is null then
    raise exception 'no such invite' using errcode = 'P0002';
  end if;
  perform public._require_member(pid);
  update public.pool_invites set revoked_at = now()
   where id = p_invite and revoked_at is null;
end;
$$;

-- What the join page may show before joining: the name, and initials.
create function public.invite_preview(p_token text)
returns table (pool_name text, member_initials text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  perform public._require_uid();
  pid := public._invite_pool(p_token);
  if pid is null then
    return; -- no rows: "This invite link is no longer valid."
  end if;

  return query
  select p.name,
         coalesce(array(
           -- The app's initialsOf: two letters of one word, else the first
           -- letter of each of the first two. By code point, not grapheme.
           select upper(case
                    when array_length(w.words, 1) is null then ''
                    when array_length(w.words, 1) = 1 then left(w.words[1], 2)
                    else left(w.words[1], 1) || left(w.words[2], 1)
                  end)
             from public.pool_members m
             join public.profiles pr on pr.id = m.user_id
             cross join lateral (
               select regexp_split_to_array(btrim(pr.display_name), '\s+') as words
             ) w
            where m.pool_id = pid and m.left_at is null
            order by m.joined_at
         ), '{}')
    from public.pools p
   where p.id = pid;
end;
$$;

-- The pool lanes the join contract maps onto. Step 2 cannot be shown without
-- them; the same token checks as the preview, and only the lanes' own words.
create function public.invite_lanes(p_token text)
returns table (id uuid, name text, icon text, description text, lane_position integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  perform public._require_uid();
  pid := public._invite_pool(p_token);
  if pid is null then
    return;
  end if;

  return query
  select l.id, l.name, l.icon, l.description, l.position
    from public.pool_lanes l
   where l.pool_id = pid
   order by l.position, l.id;
end;
$$;

-- p_links: [{ "pool_lane_id", "my_category_id" | null }].
create function public.join_pool(p_token text, p_links jsonb, p_include_history boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  pid uuid := public._invite_pool(p_token);
begin
  if pid is null then
    raise exception 'This invite link is no longer valid.' using errcode = '42501';
  end if;

  -- Already here: joining again changes nothing (links live in settings).
  if exists (
    select 1 from public.pool_members
     where pool_id = pid and user_id = uid and left_at is null
  ) then
    return pid;
  end if;

  -- A former member comes back on their old row: rejoining is a new join, so
  -- they take the last column, and their kept-or-removed choice resets.
  insert into public.pool_members (pool_id, user_id, include_history)
  values (pid, uid, coalesce(p_include_history, false))
  on conflict (pool_id, user_id) do update
     set left_at = null,
         keep_on_leave = null,
         joined_at = now(),
         include_history = excluded.include_history;

  perform public._set_links(pid, uid, p_links);
  if coalesce(p_include_history, false) then
    perform public._place_history(pid, uid);
  end if;

  return pid;
end;
$$;

-- ---------------------------------------------------------------------------
-- links and leaving
-- ---------------------------------------------------------------------------

create function public.set_lane_links(p_pool uuid, p_links jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_member(p_pool);
begin
  perform public._set_links(p_pool, uid, p_links);
end;
$$;

-- Keep: my placements and joint ripples stay, marked "Former member".
-- Remove: they are hidden from the pool, never deleted. My posts stay on my
-- Home either way; access to the pool ends now.
create function public.leave_pool(p_pool uuid, p_keep boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_member(p_pool);
begin
  if p_keep is null then
    raise exception 'keep or remove must be chosen' using errcode = '22023';
  end if;
  update public.pool_members
     set left_at = now(), keep_on_leave = p_keep
   where pool_id = p_pool and user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- joint splashes
-- ---------------------------------------------------------------------------

-- p_id is minted in the browser so the band is the real one from the start
-- (the optimistic rule); a collision fails on the primary key.
create function public.create_joint_splash(
  p_id uuid,
  p_pool uuid,
  p_pool_lane uuid,
  p_title text,
  p_icon text,
  p_declared_start date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_member(p_pool);
  sid uuid;
begin
  if not exists (select 1 from public.pool_lanes where id = p_pool_lane and pool_id = p_pool) then
    raise exception 'pool lane is not in this pool' using errcode = '42501';
  end if;

  insert into public.splashes (id, owner_id, pool_id, pool_lane_id, created_by, title, icon, declared_start)
  values (
    coalesce(p_id, gen_random_uuid()),
    null,
    p_pool,
    p_pool_lane,
    uid,
    coalesce(btrim(p_title), ''),
    nullif(btrim(coalesce(p_icon, '')), ''),
    p_declared_start
  )
  returning id into sid;
  return sid;
end;
$$;

-- Deleting a joint splash deletes its ripples (H21's composition), so it is
-- allowed only while every ripple on it is the caller's: nobody's words are
-- removed by someone else. Refused otherwise, naming the count.
create function public.delete_joint_splash(p_splash uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  pid uuid;
  others integer;
begin
  select pool_id into pid
    from public.splashes
   where id = p_splash and owner_id is null
   for update;
  if pid is null then
    raise exception 'no such joint splash' using errcode = 'P0002';
  end if;
  perform public._require_member(pid);

  select count(*) into others
    from public.ripples
   where splash_id = p_splash and author_id <> uid;
  if others > 0 then
    raise exception 'This splash holds % ripple% by other members.', others,
      case when others = 1 then '' else 's' end
      using errcode = '42501';
  end if;

  delete from public.splashes where id = p_splash;
end;
$$;

-- The API's doors: signed-in callers only.
revoke execute on function public.create_pool(text, public.pool_kind, jsonb, boolean) from public, anon;
revoke execute on function public.create_invite(uuid) from public, anon;
revoke execute on function public.revoke_invite(uuid) from public, anon;
revoke execute on function public.invite_preview(text) from public, anon;
revoke execute on function public.invite_lanes(text) from public, anon;
revoke execute on function public.join_pool(text, jsonb, boolean) from public, anon;
revoke execute on function public.set_lane_links(uuid, jsonb) from public, anon;
revoke execute on function public.leave_pool(uuid, boolean) from public, anon;
revoke execute on function public.create_joint_splash(uuid, uuid, uuid, text, text, date) from public, anon;
revoke execute on function public.delete_joint_splash(uuid) from public, anon;

grant execute on function public.create_pool(text, public.pool_kind, jsonb, boolean) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.invite_lanes(text) to authenticated;
grant execute on function public.join_pool(text, jsonb, boolean) to authenticated;
grant execute on function public.set_lane_links(uuid, jsonb) to authenticated;
grant execute on function public.leave_pool(uuid, boolean) to authenticated;
grant execute on function public.create_joint_splash(uuid, uuid, uuid, text, text, date) to authenticated;
grant execute on function public.delete_joint_splash(uuid) to authenticated;
