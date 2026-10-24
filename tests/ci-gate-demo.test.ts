import { expect, it } from 'vitest';

// A deliberate failure that only CI sees (GitHub Actions sets CI=true), to
// show a failing push does not deploy. Reverted in the next commit.
it('fails in CI on purpose', () => {
  expect(process.env.CI).toBeUndefined();
});
