-- 0013: the author's local day, stored (2026-10-23).
--
-- A record's day is the author's local calendar date at the time of
-- writing. It was derived where it was read, in the reader's zone, so a
-- splash written at 23:30 in Vancouver sat on the next day for a member
-- reading in Seoul. The date is now fixed when the row is written, from the
-- author's profile timezone, and no reader's zone moves it again; nor does
-- a later change to the author's own timezone. An occurred date (a block's
-- annotation, a post's declared date) still wins over it when read.
--
-- Additive and forward only: two columns, a trigger, a backfill. Nothing
-- dropped or narrowed.
--
-- Backfill: every existing row with America/Vancouver, as decided in the
-- session by Yoonji (2026-10-23): "Backfill every existing row with
-- America/Vancouver; all records so far were written there." The column
-- name was approved the same way: "Column name written_on: approved."

alter table public.ripples add column written_on date;
alter table public.splashes add column written_on date;

comment on column public.ripples.written_on is
  'The author''s local date when the block was written, fixed at insert from the author''s profile timezone. Its day when it has no occurred date and its post declares none.';
comment on column public.splashes.written_on is
  'The author''s (for a joint splash, its opener''s) local date when the post was made, fixed at insert. Its row when it has no range.';

-- Fixed at insert, never moved after: an update keeps the old value, so a
-- client cannot rewrite the day and a timezone change rewrites nothing.
create function public.set_written_on()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  author uuid;
  zone text;
begin
  if tg_op = 'UPDATE' then
    new.written_on := old.written_on;
    return new;
  end if;

  if tg_table_name = 'ripples' then
    author := new.author_id;
  else
    author := coalesce(new.owner_id, new.created_by);
  end if;
  select timezone into zone from public.profiles where id = author;
  new.written_on := (timezone(coalesce(zone, 'UTC'), coalesce(new.created_at, now())))::date;
  return new;
end;
$$;

create trigger ripples_set_written_on
  before insert or update of written_on on public.ripples
  for each row execute function public.set_written_on();

create trigger splashes_set_written_on
  before insert or update of written_on on public.splashes
  for each row execute function public.set_written_on();

-- The backfill bypasses the trigger's update guard by writing before the
-- trigger can see a value: the guard keeps `old.written_on`, which is null
-- here, so it is disabled for these two statements only.
alter table public.ripples disable trigger ripples_set_written_on;
alter table public.splashes disable trigger splashes_set_written_on;

update public.ripples
   set written_on = (timezone('America/Vancouver', created_at))::date
 where written_on is null;
update public.splashes
   set written_on = (timezone('America/Vancouver', created_at))::date
 where written_on is null;

alter table public.ripples enable trigger ripples_set_written_on;
alter table public.splashes enable trigger splashes_set_written_on;

alter table public.ripples alter column written_on set not null;
alter table public.splashes alter column written_on set not null;

-- The trigger always sets the value; the default exists only so a client
-- insert need not name the column (the generated types read a NOT NULL
-- column with no default as required).
alter table public.ripples alter column written_on set default current_date;
alter table public.splashes alter column written_on set default current_date;
