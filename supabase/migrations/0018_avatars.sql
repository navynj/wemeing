-- 0018: a profile photo (2026-10-23).
--
-- A person's photo replaces their initials wherever a person is shown. One
-- file per person in a private bucket, overwritten on change; the profile
-- row says whether there is one and which version, so a change gives a new
-- signed URL and the browser's cache holds the old one only while it is
-- current. Readable by its owner and by current members of a pool they are
-- in, through signed URLs, never publicly; written only by its owner.
--
-- Additive: two nullable columns, a bucket, owner-only storage policies,
-- one function. avatar_url (the Google photo) stays as it is, unread.
-- Approved in the session by Yoonji (2026-10-23): "Go ahead with 0018, with
-- these notes." — "avatar_url (the Google photo): leave the column as is
-- and do not display it. No migration change." — "Name rule in the app
-- only: agreed."

alter table public.profiles
  add column avatar_path text,
  add column avatar_version integer,
  add constraint profiles_avatar_shape check ((avatar_path is null) = (avatar_version is null)),
  -- A profile can only ever point at its own file, so a row cannot borrow
  -- someone else's photo past the visibility check.
  add constraint profiles_avatar_own check (avatar_path is null or avatar_path = id::text);

comment on column public.profiles.avatar_path is
  'The photo''s object in the avatars bucket (the owner''s id), or null for initials.';
comment on column public.profiles.avatar_version is
  'Bumped on every change: part of the signed URL''s cache key, so a new photo is a new URL.';

-- ---------------------------------------------------------------------------
-- the bucket: private; each person writes their own one file
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- The object is named by its owner's id and nothing else. Nobody else reads
-- it through storage: others get signed URLs, after visible_avatars says yes.
create policy "an avatar is written by its owner"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name = auth.uid()::text);

create policy "an avatar is replaced by its owner"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text)
  with check (bucket_id = 'avatars' and name = auth.uid()::text);

create policy "an avatar is removed by its owner"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

-- An upsert reads back the object it overwrites, so its owner may see it.
create policy "an avatar is seen by its owner"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and name = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- whose photos may I see: mine, and those of current members of my pools
-- ---------------------------------------------------------------------------

create function public.visible_avatars(uids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u), '{}')
    from unnest(uids) as u
   where auth.uid() is not null
     and (
       u = auth.uid()
       or exists (
         select 1
           from public.pool_members mine
           join public.pool_members theirs on theirs.pool_id = mine.pool_id
          where mine.user_id = auth.uid()
            and mine.left_at is null
            and theirs.user_id = u
            and theirs.left_at is null
       )
     );
$$;

revoke execute on function public.visible_avatars(uuid[]) from public, anon;
grant execute on function public.visible_avatars(uuid[]) to authenticated;
