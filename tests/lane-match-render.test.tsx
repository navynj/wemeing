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
  it('starts at ↔ and cycles → then ←, its caption always shown', () => {
    const { container } = render(<Match />);
    const control = container.querySelector('[data-match-direction="games"]')!;
    const caption = (): string | null =>
      container.querySelector('[data-match-caption="games"]')!.textContent;
    expect(control.textContent).toBe('↔');
    expect(caption()).toBe('Share both ways');
    fireEvent.click(control);
    expect(control.textContent).toBe('→');
    expect(caption()).toBe('Share my records');
    fireEvent.click(control);
    expect(control.textContent).toBe('←');
    expect(caption()).toBe('Bring pool records to my lane');
    expect(container.querySelector('[data-direction-state]')!.textContent).toBe('{"games":"in"}');
  });

  it('has no direction on an unconnected row', () => {
    const { container } = render(<Match />);
    expect(container.querySelector('[data-match-direction="notes"]')).toBeNull();
    expect(container.querySelector('[data-match-caption="notes"]')).toBeNull();
  });
});
