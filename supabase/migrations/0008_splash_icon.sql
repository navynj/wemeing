-- A splash's own icon (round 3): an optional glyph that stands for the post
-- on the grid, the pills and the cards, before its lane's emoji.
--
-- Forward only, additive: a nullable column, no backfill, no RLS change —
-- the existing owner policies on splashes cover it. The app keeps the
-- one-grapheme rule; the check only stops the column holding arbitrary text
-- (a single emoji with modifiers and joiners stays well under 16 code points).

alter table public.splashes
  add column icon text,
  add constraint splashes_icon_short check (icon is null or char_length(icon) <= 16);
