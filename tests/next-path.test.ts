import { describe, expect, it } from 'vitest';

import { safeNext } from '@/lib/next-path';

/** `?next=` accepts a relative path that starts with a single slash, and nothing else (H23). */
describe('safeNext', () => {
  it('keeps a relative path, query included', () => {
    expect(safeNext('/join/abc')).toBe('/join/abc');
    expect(safeNext('/pool/1?view=date')).toBe('/pool/1?view=date');
  });

  it('refuses anything that could leave this origin', () => {
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      'join/abc',
      '/\t/evil.example',
      '/\n/evil.example',
      '',
      null,
      undefined,
    ]) {
      expect(safeNext(bad), String(bad)).toBe('/');
    }
  });
});
