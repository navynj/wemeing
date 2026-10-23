-- 0012: a pool outlives its creator; joining never touches my own records.
--
-- (1) pools.owner_id was ON DELETE CASCADE from 0001: deleting the creator's
--     account deleted the pool, and with it every member's joint splashes
--     and their ripples. A pool belongs to its members (H23), so the creator
--     reference becomes nullable and SET NULL. pool_invites.created_by gets
--     the same treatment (it cascaded only invites, but an invite outliving
--     who made it is the same rule); splashes.created_by was SET NULL from
--     0009 and stays.
--
-- (2) "Include my earlier records" places existing posts only. 0011 gave a
--     lone block in a linked lane a post row of its own first; joining a pool
--     must never create or modify records in my private space, so lone
--     blocks are left as they are and simply not placed.
--
-- Destructive DDL (two foreign keys are dropped and recreated with SET
-- NULL). Approved in the session by Yoonji (2026-10-23): "migration 0012
-- changes pools.owner_id to nullable with on delete set null, so deleting
-- the creator never deletes the pool or anyone's joint ripples. Same check
-- for splashes.created_by and pool_invites.created_by. Rehearse, backup,
-- push as before; I approve this change." — and: "do not create posts from
-- lone blocks during a join. Place only existing posts in linked lanes."

-- ---------------------------------------------------------------------------
-- (1) creators
-- ---------------------------------------------------------------------------

alter table public.pools alter column owner_id drop not null;
alter table public.pools drop constraint pools_owner_id_fkey;
alter table public.pools
  add constraint pools_owner_id_fkey
  foreign key (owner_id) references public.profiles (id) on delete set null;

comment on column public.pools.owner_id is
  'Who opened the pool, or null once their account is gone. Grants no rights (H23); deleting it never deletes the pool.';

alter table public.pool_invites alter column created_by drop not null;
alter table public.pool_invites drop constraint pool_invites_created_by_fkey;
alter table public.pool_invites
  add constraint pool_invites_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- (2) history places existing posts only
-- ---------------------------------------------------------------------------

-- Same signature, so create_pool and join_pool pick it up unchanged. It
-- writes only splash_placements — the pool's sharing record — and never a
-- row of splashes or ripples.
create or replace function public._place_history(pid uuid, uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
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

revoke execute on function public._place_history(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_joint_splash: the icon and the declared date are optional
-- ---------------------------------------------------------------------------

-- Defaults only, the body unchanged: an argument with a default is optional
-- to the generated client types, which otherwise read every argument as
-- non-null and leave "no icon" unsayable. Adding a default is allowed by
-- CREATE OR REPLACE; nothing is dropped.
create or replace function public.create_joint_splash(
  p_id uuid,
  p_pool uuid,
  p_pool_lane uuid,
  p_title text,
  p_icon text default null,
  p_declared_start date default null
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
