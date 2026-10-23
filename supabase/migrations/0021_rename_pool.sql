-- 0021: the pool's creator renames it (2026-10-23).
--
-- Pools are written only through functions (0010). Renaming is the
-- creator's alone, as deleting is (0015): Yoonji, in the session, "rename은
-- owner만". The name keeps pools_name_present (1–60 once trimmed). Current
-- members' origin tags follow through refresh_pool_origin (0015); a leaver's
-- snapshot stays frozen, as before.
--
-- Additive: one function.

create function public.rename_pool(p_pool uuid, p_name text)
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
    raise exception 'only the Pool''s creator renames it' using errcode = '42501';
  end if;
  update public.pools set name = btrim(p_name) where id = p_pool;
end;
$$;

revoke execute on function public.rename_pool(uuid, text) from public, anon;
grant execute on function public.rename_pool(uuid, text) to authenticated;
