// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { LaneMatch } from '@/features/pool/lane-match';
import type { Directions, Links } from '@/features/pool/match';

afterEach(cleanup);

function Match() {
  const [links, setLinks] = useState<Links>({ games: 'my-games', notes: null });
  const [directions, setDirections] = useState<Directions>({});
  return (
    <LaneMatch
      poolName="Our Pool"
      lanes={[
        { key: 'games', name: 'Games', icon: '🎲', description: null },
        { key: 'notes', name: 'Notes', icon: '📓', description: null },
      ]}
      categories={[{ id: 'my-games', name: 'Games', icon: '🎲' }]}
      links={links}
      onLinksChange={setLinks}
      directions={directions}
      onDirectionsChange={setDirections}
      onCreateLane={() => Promise.resolve({ message: 'not here' })}
      action={<span data-direction-state>{JSON.stringify(directions)}</span>}
    />
  );
}

describe('a link’s direction (0017)', () => {
  it('starts at ↔ and cycles ← then →, its caption always shown', () => {
    const { container } = render(<Match />);
    const control = container.querySelector('[data-match-direction="games"]')!;
    const caption = (): string | null =>
      container.querySelector('[data-match-caption="games"]')!.textContent;
    expect(control.textContent).toBe('↔');
    expect(caption()).toBe('Share both ways');
    fireEvent.click(control);
    expect(control.textContent).toBe('←');
    expect(caption()).toBe('Share my records to the pool');
    fireEvent.click(control);
    expect(control.textContent).toBe('→');
    expect(caption()).toBe('Bring pool records to my lane');
    expect(container.querySelector('[data-direction-state]')!.textContent).toContain(
      '"games":"in"',
    );
  });

  it('has no direction on an unconnected row', () => {
    const { container } = render(<Match />);
    expect(container.querySelector('[data-match-direction="notes"]')).toBeNull();
    expect(container.querySelector('[data-match-caption="notes"]')).toBeNull();
  });
});

function Church() {
  // As name matching or a hurried hand leaves it: one lane of mine on three pool lanes.
  const [links, setLinks] = useState<Links>({ word: 'church', prayer: 'church', thanks: 'church' });
  const [directions, setDirections] = useState<Directions>({});
  return (
    <LaneMatch
      poolName="Sarang"
      lanes={[
        { key: 'word', name: '말씀', icon: '📖', description: null },
        { key: 'prayer', name: '기도', icon: '🙏', description: null },
        { key: 'thanks', name: '감사', icon: '🥹', description: null },
      ]}
      categories={[
        { id: 'church', name: 'Church', icon: '⛪' },
        { id: 'day', name: 'Day', icon: '🖋' },
      ]}
      links={links}
      onLinksChange={setLinks}
      directions={directions}
      onDirectionsChange={setDirections}
      onCreateLane={() => Promise.resolve({ message: 'not here' })}
      action={<span data-direction-state>{JSON.stringify(directions)}</span>}
    />
  );
}

describe('one sender per lane of mine (review)', () => {
  const glyph = (root: Element, key: string) =>
    root.querySelector(`[data-match-direction="${key}"]`)!;

  it('lets only the first row share a lane; the rest bring in only, and say why', () => {
    const { container } = render(<Church />);
    expect(glyph(container, 'word').textContent).toBe('↔');
    expect(glyph(container, 'prayer').textContent).toBe('→');
    expect(glyph(container, 'thanks').textContent).toBe('→');
    expect((glyph(container, 'prayer') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-match-caption="prayer"]')!.textContent).toContain(
      'Already shared to 말씀',
    );
  });

  it('unlocks the next row once the first stops sending, without sharing for you', () => {
    const { container } = render(<Church />);
    // ↔ → ← → →: the first row now only brings in.
    fireEvent.click(glyph(container, 'word'));
    fireEvent.click(glyph(container, 'word'));
    expect(glyph(container, 'word').textContent).toBe('→');
    // Unlocked, but never sharing on its own: sending is a choice made here.
    expect((glyph(container, 'prayer') as HTMLButtonElement).disabled).toBe(false);
    expect(glyph(container, 'prayer').textContent).toBe('→');
    fireEvent.click(glyph(container, 'prayer'));
    expect(glyph(container, 'prayer').textContent).toBe('↔');
    // And now it is 기도 that holds the lane.
    expect((glyph(container, 'thanks') as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('[data-match-caption="thanks"]')!.textContent).toContain(
      'Already shared to 기도',
    );
  });

  it('lets a row share again once it connects a different lane', () => {
    const { container } = render(<Church />);
    fireEvent.change(container.querySelector('[data-match-select="thanks"]')!, {
      target: { value: 'day' },
    });
    expect(glyph(container, 'thanks').textContent).toBe('↔');
  });
});
