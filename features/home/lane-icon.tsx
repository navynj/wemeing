/**
 * The lane glyph: two lane lines converging into the distance with a dashed
 * centre. Drawn here because lucide has no lane; the stroke matches the
 * lucide icons beside it. Not Waves — waves mean a post's block count.
 */
export function LaneIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-lane-icon
    >
      <path d="M4 20 9 4" />
      <path d="M20 20 15 4" />
      <path d="M12 4v3" />
      <path d="M12 11v3" />
      <path d="M12 18v2" />
    </svg>
  );
}
