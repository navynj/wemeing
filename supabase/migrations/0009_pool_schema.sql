-- 0009: the Pool world's shape (H23). Schema only; the access rules are 0010,
-- the doors (SECURITY DEFINER functions) 0011.
--
-- The reserved 0001 tables are extended rather than replaced: pools,
-- pool_members, pool_lanes and lane_mappings already carried the seats, and
-- splashes.pool_id was kept nullable by 0005 for exactly this. New tables are
-- created with RLS on and no policy, so between this migration and 0010 they
-- answer nobody.
--
-- Two NOT NULLs are relaxed (widening, not destructive). Approved in the
-- session by Yoonji (2026-10-23): "Also approved: making splashes.owner_id and
-- pools.invite_code nullable." Nothing here drops.

-- ---------------------------------------------------------------------------
-- pools
-- ---------------------------------------------------------------------------

-- Display only: the label on the create screen. It changes no behaviour.
create type public.pool_kind as enum (
  'couple_diary', 'study', 'running_crew', 'faith_group', 'friends'
);

-- Stored now so Open needs no migration later; nothing in this phase can
-- write 'open' (the create function always writes 'private').
create type public.pool_visibility as enum ('private', 'open');

alter table public.pools
  add column kind public.pool_kind,
  add column visibility public.pool_visibility not null default 'private',
  add constraint pools_name_present check (length(btrim(name)) between 1 and 60);

-- Superseded by pool_invites: a link that expires and can be revoked. The
-- column stays, unread.
alter table public.pools alter column invite_code drop not null;

comment on column public.pools.owner_id is
  'Who opened the pool. Grants no rights: every member is equal in this phase (H23); roles arrive as a column on pool_members.';
comment on column public.pools.invite_code is
  'Superseded by pool_invites (H23). Unread.';

-- ---------------------------------------------------------------------------
-- pool_members — one row per person per pool, kept after leaving
-- ---------------------------------------------------------------------------

alter table public.pool_members
  add column left_at timestamptz,
  -- Chosen at join: place my earlier posts in linked lanes, or only new ones.
  add column include_history boolean not null default false,
  -- Chosen at leave: whether what I placed stays visible to the members.
  add column keep_on_leave boolean,
  add constraint pool_members_leave_shape check ((left_at is null) = (keep_on_leave is null));

comment on column public.pool_members.left_at is
  'Set when the member leaves; the row stays so a former member''s kept records can be labelled. Rejoining clears it.';
comment on column public.pool_members.keep_on_leave is
  'Null while a member. On leave: true keeps their placements and joint ripples visible ("Former member"), false hides them (never deletes).';

create index pool_members_user_idx on public.pool_members (user_id) where left_at is null;

-- ---------------------------------------------------------------------------
-- pool_lanes — the group's vocabulary
-- ---------------------------------------------------------------------------

alter table public.pool_lanes
  add column description text,
  add constraint pool_lanes_name_present check (length(btrim(name)) between 1 and 40),
  add constraint pool_lanes_icon_short check (icon is null or char_length(icon) <= 16),
  add constraint pool_lanes_description_short check (
    description is null or char_length(description) <= 80
  ),
  -- The target of the composite keys below: a reference that names a lane
  -- and a pool can only name a lane of that pool.
  add constraint pool_lanes_id_pool_key unique (id, pool_id);

-- ---------------------------------------------------------------------------
-- lane_mappings — one of my lanes per pool lane (C5: the plumbing)
-- ---------------------------------------------------------------------------

alter table public.lane_mappings add column pool_id uuid;

-- No rows exist anywhere yet; the backfill is here so the migration is true
-- for any database it meets.
update public.lane_mappings m
   set pool_id = l.pool_id
  from public.pool_lanes l
 where l.id = m.pool_lane_id;

alter table public.lane_mappings
  alter column pool_id set not null,
  add constraint lane_mappings_pool_lane_fkey
    foreign key (pool_lane_id, pool_id)
    references public.pool_lanes (id, pool_id) on delete cascade,
  -- A pool lane takes at most one of my lanes. Leaving it unlinked is no row.
  add constraint lane_mappings_one_per_pool_lane unique (user_id, pool_lane_id);

create index lane_mappings_pool_idx on public.lane_mappings (pool_id, user_id);

-- ---------------------------------------------------------------------------
-- splashes — a joint splash is owned by its pool
-- ---------------------------------------------------------------------------

alter table public.splashes alter column owner_id drop not null;

alter table public.splashes
  add column pool_lane_id uuid,
  -- Who opened a joint splash, for display. Not an owner: the pool is.
  add column created_by uuid references public.profiles (id) on delete set null,
  -- RESTRICT: a lane cannot vanish from under other members' ripples.
  add constraint splashes_pool_lane_fkey
    foreign key (pool_lane_id, pool_id)
    references public.pool_lanes (id, pool_id) on delete restrict,
  -- Exactly two shapes. Personal: an owner, no pool. Joint: a pool and its
  -- lane, no owner — so every solo query (`owner_id = me`) is unchanged.
  -- A joint splash has no personal declared lane and no personal shelf.
  add constraint splashes_owner_shape check (
    (owner_id is not null and pool_id is null and pool_lane_id is null)
    or (owner_id is null and pool_id is not null and pool_lane_id is not null
        and declared_lane_id is null and session_id is null)
  );

comment on column public.splashes.pool_id is
  'Set only on a joint splash: the pool that owns it (H23). A personal post reaches a pool through splash_placements, never through this column.';
comment on column public.splashes.owner_id is
  'The author of a personal post. Null on a joint splash, which the pool owns.';

create index splashes_pool_idx on public.splashes (pool_id, created_at desc) where pool_id is not null;

-- ---------------------------------------------------------------------------
-- splash_placements — the sharing record (H20h)
-- ---------------------------------------------------------------------------

-- One row per personal post per pool. `shared` is the per-post switch; a
-- switched-off row is kept so "off" stays distinct from "never placed", and
-- relinking a lane cannot silently bring it back. The pool-side lane lives
-- here and never on the post or its blocks.
create table public.splash_placements (
  splash_id uuid not null references public.splashes (id) on delete cascade,
  pool_id uuid not null references public.pools (id) on delete cascade,
  pool_lane_id uuid not null,
  shared boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (splash_id, pool_id),
  constraint splash_placements_pool_lane_fkey
    foreign key (pool_lane_id, pool_id)
    references public.pool_lanes (id, pool_id) on delete cascade
);

create index splash_placements_pool_idx on public.splash_placements (pool_id, pool_lane_id);

alter table public.splash_placements enable row level security;

-- ---------------------------------------------------------------------------
-- pool_invites — /join/[token]
-- ---------------------------------------------------------------------------

create table public.pool_invites (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  -- 24 random bytes, base64url: minted by create_invite (0011), never by
  -- the client. Kept readable so a member can copy the link again.
  token text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  constraint pool_invites_token_shape check (token ~ '^[A-Za-z0-9_-]{32}$')
);

create index pool_invites_pool_idx on public.pool_invites (pool_id, created_at desc);

alter table public.pool_invites enable row level security;
