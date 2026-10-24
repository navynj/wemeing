-- 0024: a pool's photo (2026-10-23).
--
-- A pool may have a photo in place of its monogram, on the strip, Home's
-- pool column, the pool's header, the create tile and the join screen; a
-- pool I left keeps the neutral tile. Same pipeline as profile photos
-- (0018): one file per pool in a private bucket, overwritten on change, the
-- row naming whether there is one and which version, read only through
-- signed URLs. Only the pool's creator changes or removes it, as renaming
-- (0021).
--
-- Approved in the session (Yoonji, 2026-10-23): "Pool photo, 0024: approved.
-- 1. Only the creator can change or remove the pool photo, like renaming.
-- 2. Show it where you listed, plus the join screen at /join/[token] ... "A
-- pool you left" keeps the neutral tile, no photo."
--
-- Additive: two nullable columns, a bucket, creator-only storage policies,
-- three functions.

alter table public.pools
  add column photo_path text,
  add column photo_version integer,
  add constraint pools_photo_shape check ((photo_path is null) = (photo_version is null)),
  -- A pool can only point at its own file.
  add constraint pools_photo_own check (photo_path is null or photo_path = id::text);

comment on column public.pools.photo_path is
  'The photo''s object in the pool-photos bucket (the pool''s id), or null for the monogram.';
comment on column public.pools.photo_version is
  'Bumped on every change: part of the signed URL''s cache key.';

-- ---------------------------------------------------------------------------
-- the bucket: private; the pool's creator writes its one file
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('pool-photos', 'pool-photos', false)
on conflict (id) do nothing;

-- Whether I created this pool and am in it now: the storage policies' test,
-- run past the pools RLS so the object's name (text) can be checked safely.
create function public.is_pool_creator(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.pools p
      join public.pool_members m on m.pool_id = p.id
     where p.id::text = object_name
       and p.owner_id = auth.uid()
       and m.user_id = auth.uid()
       and m.left_at is null
  );
$$;

revoke execute on function public.is_pool_creator(text) from public, anon;
grant execute on function public.is_pool_creator(text) to authenticated;

create policy "a pool photo is written by the pool's creator"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pool-photos' and public.is_pool_creator(name));

create policy "a pool photo is replaced by the pool's creator"
  on storage.objects for update to authenticated
  using (bucket_id = 'pool-photos' and public.is_pool_creator(name))
  with check (bucket_id = 'pool-photos' and public.is_pool_creator(name));

create policy "a pool photo is removed by the pool's creator"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pool-photos' and public.is_pool_creator(name));

-- An upsert reads back the object it overwrites. Members read the photo
-- through signed URLs, after visible_pool_photos says yes.
create policy "a pool photo is seen by the pool's creator"
  on storage.objects for select to authenticated
  using (bucket_id = 'pool-photos' and public.is_pool_creator(name));

-- ---------------------------------------------------------------------------
-- the creator sets or clears it (the bytes went up from the browser first)
-- ---------------------------------------------------------------------------

create function public.set_pool_photo(p_pool uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public._require_uid();
begin
  perform public._require_member(p_pool);
  if not exists (select 1 from public.pools where id = p_pool and owner_id = uid) then
    raise exception 'only the Pool''s creator changes its photo' using errcode = '42501';
  end if;
  if p_on then
    if not exists (
      select 1 from storage.objects where bucket_id = 'pool-photos' and name = p_pool::text
    ) then
      raise exception 'no photo was uploaded for this pool' using errcode = 'P0002';
    end if;
    update public.pools
       set photo_path = p_pool::text, photo_version = coalesce(photo_version, 0) + 1
     where id = p_pool;
  else
    update public.pools set photo_path = null, photo_version = null where id = p_pool;
  end if;
end;
$$;

revoke execute on function public.set_pool_photo(uuid, boolean) from public, anon;
grant execute on function public.set_pool_photo(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- who may see which pools' photos: the pools I am in now
-- ---------------------------------------------------------------------------

create function public.visible_pool_photos(pids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(pid), '{}')
    from unnest(pids) as pid
   where auth.uid() is not null
     and exists (
       select 1 from public.pool_members m
        where m.pool_id = pid and m.user_id = auth.uid() and m.left_at is null
     );
$$;

revoke execute on function public.visible_pool_photos(uuid[]) from public, anon;
grant execute on function public.visible_pool_photos(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- the join screen: the photo of a pool a valid invite opens, for the server
-- ---------------------------------------------------------------------------

-- The same token checks as invite_preview (valid, unexpired, unrevoked).
-- Called by the server with the service role only, which signs a short-lived
-- URL for the preview; the path itself never reaches a browser, and
-- invite_preview is unchanged.
create function public.invite_photo(p_token text)
returns table (photo_path text, photo_version integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.photo_path, p.photo_version
    from public.pools p
   where p.id = public._invite_pool(p_token)
     and p.photo_path is not null;
$$;

revoke execute on function public.invite_photo(text) from public, anon, authenticated;
