/**
 * Where to go after signing in, from an untrusted `?next=` (H23).
 *
 * Only a relative path that starts with exactly one slash is accepted:
 * `//evil.example` and `/\evil.example` are protocol-relative to a browser,
 * and anything with a scheme is another site. Everything else falls back to
 * Home, so a bad value costs a detour, never a redirect off this origin.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//') || value.startsWith('/\\')) return '/';
  // Control characters (a tab or newline inside the path) are stripped by
  // some browsers before parsing, which can turn `/\t/evil` into `//evil`.
  if (/[\u0000-\u001f\u007f]/.test(value)) return '/';
  return value;
}
