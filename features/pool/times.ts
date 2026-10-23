/** `9:30 PM`, in a zone. */
export function clockIn(instant: string, timeZone: string): string {
  return new Date(instant).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

/** `Vancouver`, from `America/Vancouver`. */
export function placeOf(timeZone: string): string {
  return (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');
}

/**
 * When a ripple was written, as a reader reads it (0013): the time in my
 * zone; when the author's differs, theirs after it — `9:30 PM · 11:30 PM in
 * Vancouver` — so a late entry reads as late where it was written. Null when
 * the zones agree.
 */
export function authorClock(
  instant: string,
  viewerZone: string,
  authorZone: string,
): { mine: string; theirs: string | null } {
  const mine = clockIn(instant, viewerZone);
  if (authorZone === viewerZone) return { mine, theirs: null };
  const theirs = clockIn(instant, authorZone);
  return { mine, theirs: `${theirs} in ${placeOf(authorZone)}` };
}
