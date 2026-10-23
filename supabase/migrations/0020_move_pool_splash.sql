-- 0020: a pool's splash moves among that pool's lanes (2026-10-23).
--
-- From its edit sheet a pool's splash offers only that pool's lanes. Neither
-- kind can move by a plain update:
--   * Just mine: its placement is on an unlinked pool lane, and the placement
--     policy admits only a lane I linked (lane_is_mine_in).
--   * Joint: each member's ripples on it are filed in that member's lane
--     linked to its pool lane (0016, 0017), so moving the splash must re-file
--     them, and those rows are not mine to write.
-- So one function does both, checking everything itself:
--   * a signed-in, current member;
--   * the lane is in the splash's own pool;
--   * Just mine: only its author;
--   * my own splash merely shared to a pool: never (its pool lane follows my
--     link).
--
-- Additive: one function. Approved in the session: Yoonji answered the plan
-- ("rename은 owner만") and asked for the edit sheet to keep a pool's splash
-- to its pool's lanes ("풀의 스플래시면 편집화면은 풀 레인으로 한정").

create function public.move_pool_splash(p_splash uuid, p_pool_lane uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
  s record;
  pid uuid;
begin
  select id, owner_id, pool_id, own_pool_id into s
    from public.splashes where id = p_splash;
  if not found then
    raise exception 'that splash is gone' using errcode = 'P0002';
  end if;

  if s.owner_id is null then
    pid := s.pool_id;
  elsif s.own_pool_id is not null then
    if s.owner_id <> uid then
      raise exception 'only its author moves a Just-mine splash' using errcode = '42501';
    end if;
    pid := s.own_pool_id;
  else
    raise exception 'only a pool''s own splash moves among its lanes' using errcode = '42501';
  end if;
  perform public._require_member(pid);

  if not exists (select 1 from public.pool_lanes where id = p_pool_lane and pool_id = pid) then
    raise exception 'that lane is not in this pool' using errcode = '42501';
  end if;

  if s.owner_id is null then
    update public.splashes set pool_lane_id = p_pool_lane where id = p_splash;
    -- Each current member's ripples follow their own link to the new pool
    -- lane, by the rule writing uses (0016, 0017): their linked lane when it
    -- brings in, else none. A former member's kept ripples stay as they are.
    update public.ripples r
       set category_id = (
         select m.my_category_id
           from public.lane_mappings m
          where m.user_id = r.author_id
            and m.pool_id = pid
            and m.pool_lane_id = p_pool_lane
            and m.direction in ('both', 'in')
       )
     where r.splash_id = p_splash
       and exists (
         select 1 from public.pool_members pm
          where pm.pool_id = pid and pm.user_id = r.author_id and pm.left_at is null
       );
  else
    update public.splash_placements
       set pool_lane_id = p_pool_lane, updated_at = now()
     where splash_id = p_splash and pool_id = pid;
  end if;
end;
$$;

revoke execute on function public.move_pool_splash(uuid, uuid) from public, anon;
grant execute on function public.move_pool_splash(uuid, uuid) to authenticated;
