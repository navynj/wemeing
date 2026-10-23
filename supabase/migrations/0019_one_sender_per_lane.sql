-- 0019: one sender per lane of mine in a pool (2026-10-23).
--
-- A lane of mine may send (out or both) into at most one pool lane in a
-- pool: a post sits in one pool lane per pool (splash_placements' key), so a
-- second sending link would leave where it lands to chance. Bringing in
-- (in) from several pool lanes is fine. The app already holds later rows to
-- "in" (settleDirections); this makes it a rule for every path, create, join
-- and settings alike, which all write through _set_links.
--
-- Additive: one partial unique index. Production has 4 links and no
-- duplicates, checked before the push. Yoonji asked for it in the session:
-- "양방향이나 <-처럼 내 기록이 풀레인으로 들어가는 경우는 그 풀에서 하나만
-- 지정할 수 있게 제약 가드 설정. ->는 같은 거 여러개도 괜찮음".

create unique index lane_mappings_one_sender
  on public.lane_mappings (user_id, pool_id, my_category_id)
  where direction in ('out', 'both');

comment on index public.lane_mappings_one_sender is
  'A lane of mine sends into one pool lane per pool; bringing in is unlimited (0019).';
