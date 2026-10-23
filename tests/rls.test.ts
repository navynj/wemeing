import { describe, expect, it } from 'vitest';

import {
  anonymous,
  asUser,
  JAE,
  JAE_RIPPLE,
  LOCKED_RIPPLE,
  MINA,
  UNLOCKED_RIPPLE,
  YOONJI,
} from './as-user';

/**
 * The leak model is enforced in RLS, not in application code (CLAUDE.md), so
 * these tests query PostgREST as real users and assert on what comes back.
 * Anything provable here is provable for every future feature; anything the
 * client can reach here, it can reach from the browser.
 */

describe('signed out', () => {
  it('reaches nothing at all', async () => {
    const anon = anonymous();

    for (const table of ['ripples', 'profiles', 'links', 'my_categories'] as const) {
      const { data } = await anon.from(table).select('*');
      expect(data, table).toEqual([]);
    }
  });
});

describe('the Link path', () => {
  it('shows a linked friend an unlocked ripple', async () => {
    const { data, error } = await asUser(MINA)
      .from('ripples')
      .select('id, note')
      .eq('id', UNLOCKED_RIPPLE);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('hides a locked ripple from a linked friend', async () => {
    const { data, error } = await asUser(MINA)
      .from('ripples')
      .select('id, note')
      .eq('id', LOCKED_RIPPLE);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('keeps a locked ripple visible to its author', async () => {
    const { data } = await asUser(YOONJI).from('ripples').select('id').eq('id', LOCKED_RIPPLE);

    expect(data).toHaveLength(1);
  });

  it('hides everything from someone who is not linked', async () => {
    // Mina and Jae share a friend, not a Link (C3: never join tables to imply
    // friendship). Jae's ripple is unlocked and still unreachable.
    const { data } = await asUser(MINA).from('ripples').select('id').eq('id', JAE_RIPPLE);

    expect(data).toEqual([]);
  });

  it("shows a day's ripples to the friend but never the locked one", async () => {
    const { data } = await asUser(MINA).from('ripples').select('id').eq('author_id', YOONJI);

    const ids = (data ?? []).map((ripple) => ripple.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain(LOCKED_RIPPLE);
  });
});

/**
 * ROADMAP blocker for P2: the Link read path must be scoped. Today a linked
 * friend reads every unlocked ripple of mine, which was never intended
 * (raised 2026-10-23, H23). Production has no links, so nothing leaks yet.
 *
 * `it.fails` holds the intended rule while the policy still contradicts it:
 * this passes while the leak exists and FAILS the moment the path is scoped,
 * which is the signal to drop `.fails` and retire the Link-path tests above
 * that assert the old behaviour.
 */
describe('the Link path, as it must become before P2', () => {
  it.fails('hides from a linked friend every ripple outside a shared pool', async () => {
    // Yoonji and Mina are Linked and share no pool.
    const { data } = await asUser(MINA).from('ripples').select('id').eq('author_id', YOONJI);
    expect(data).toEqual([]);
  });
});

describe('lock state', () => {
  it('does not expose audience rows to a linked friend', async () => {
    // Reading the absence of a lock row would be enough to infer the presence
    // of one elsewhere, so routing is private in both directions.
    const { data } = await asUser(MINA).from('ripple_audience').select('*');

    expect(data).toEqual([]);
  });

  it('exposes audience rows to the author', async () => {
    const { data } = await asUser(YOONJI)
      .from('ripple_audience')
      .select('*')
      .eq('ripple_id', LOCKED_RIPPLE);

    expect(data).toHaveLength(1);
  });
});

describe('the witness signal', () => {
  it('lets the author read the view count', async () => {
    const { data, error } = await asUser(YOONJI)
      .from('ripple_views')
      .select('*')
      .eq('ripple_id', UNLOCKED_RIPPLE);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('never shows a viewer who else has looked', async () => {
    // A6: the signal is a count, and only the author has it. Not even one's
    // own view row is readable back.
    const { data } = await asUser(MINA).from('ripple_views').select('*');

    expect(data).toEqual([]);
  });

  it('records a view of a ripple the viewer can see', async () => {
    const { error } = await asUser(MINA).rpc('record_ripple_view', { rid: UNLOCKED_RIPPLE });

    expect(error).toBeNull();
  });

  it('counts people rather than openings', async () => {
    const mina = asUser(MINA);
    await mina.rpc('record_ripple_view', { rid: UNLOCKED_RIPPLE });
    await mina.rpc('record_ripple_view', { rid: UNLOCKED_RIPPLE });

    const { count } = await asUser(YOONJI)
      .from('ripple_views')
      .select('*', { count: 'exact', head: true })
      .eq('ripple_id', UNLOCKED_RIPPLE);

    expect(count).toBe(1);
  });

  it('refuses a view of a locked ripple', async () => {
    const { error } = await asUser(MINA).rpc('record_ripple_view', { rid: LOCKED_RIPPLE });

    expect(error).not.toBeNull();
  });

  it('does not let an author witness themselves', async () => {
    // A no-op, not an error: opening one's own Ripple is routine.
    const { error } = await asUser(YOONJI).rpc('record_ripple_view', { rid: UNLOCKED_RIPPLE });
    expect(error).toBeNull();

    const { data } = await asUser(YOONJI)
      .from('ripple_views')
      .select('viewer_id')
      .eq('ripple_id', UNLOCKED_RIPPLE);

    expect((data ?? []).map((view) => view.viewer_id)).toEqual([MINA]);
  });

  it('refuses a direct write to the view table', async () => {
    const { error } = await asUser(MINA)
      .from('ripple_views')
      .insert({ ripple_id: UNLOCKED_RIPPLE, viewer_id: MINA });

    expect(error).not.toBeNull();
  });
});

describe('profiles', () => {
  it('is readable by a linked user', async () => {
    const { data } = await asUser(MINA).from('profiles').select('display_name').eq('id', YOONJI);

    expect(data).toEqual([{ display_name: 'Yoonji' }]);
  });

  it('is not readable by a stranger', async () => {
    const { data } = await asUser(MINA).from('profiles').select('display_name').eq('id', JAE);

    expect(data).toEqual([]);
  });
});

describe('write paths', () => {
  it('refuses a ripple authored as someone else', async () => {
    const { error } = await asUser(MINA).from('ripples').insert({
      author_id: YOONJI,
      category_id: 'a1000000-0000-0000-0000-000000000004',
      occurred_on: '2026-01-01',
    });

    expect(error).not.toBeNull();
  });

  it("refuses to delete another author's ripple", async () => {
    await asUser(MINA).from('ripples').delete().eq('id', UNLOCKED_RIPPLE);

    // Delete of an invisible row is a silent no-op, so assert on the row.
    const { data } = await asUser(YOONJI).from('ripples').select('id').eq('id', UNLOCKED_RIPPLE);
    expect(data).toHaveLength(1);
  });

  it('refuses to link two other people together', async () => {
    const { error } = await asUser(MINA).from('links').insert({ user_a: JAE, user_b: YOONJI });

    expect(error).not.toBeNull();
  });
});
