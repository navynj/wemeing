// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { StrictMode, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/splash/s1', useRouter: () => router }));

/** Each exit animation, with a hand to finish it. */
const runs = vi.hoisted(
  () => [] as { target: Element; keyframes: Record<string, unknown>; finish: () => void }[],
);
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    animate: (target: Element, keyframes: Record<string, unknown>) => {
      let finish!: () => void;
      const finished = new Promise<void>((resolve) => (finish = resolve));
      runs.push({ target, keyframes, finish });
      return { finished };
    },
  };
});

import { InputSheetProvider } from '@/features/input-sheet/sheet-provider';
import { SplashModal } from '@/features/splash/splash-modal';

/**
 * Back closes the splash sheet with its exit (review): the route takes the
 * sheet away, so a still copy of it plays the spring down — a fade under
 * reduced motion — and is removed when it finishes.
 */
function Routed() {
  // As Next's router does on back: the slot stops rendering the sheet.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return (
    <InputSheetProvider>
      {open ? (
        <SplashModal closeTo={null}>
          <p>a splash</p>
        </SplashModal>
      ) : null}
    </InputSheetProvider>
  );
}

function reducedMotion(on: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: on && query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

const leaving = () => document.body.querySelector('[data-splash-leaving]');

beforeEach(() => {
  runs.length = 0;
  Object.values(router).forEach((fn) => fn.mockReset());
  reducedMotion(false);
});
afterEach(() => {
  cleanup();
  document.body.querySelectorAll('[data-splash-leaving]').forEach((n) => n.remove());
});

describe('closing the splash sheet by back (review)', () => {
  it('runs the exit spring on a held copy after popstate, then removes it', async () => {
    render(<Routed />);
    expect(document.body.querySelector('[data-splash-modal]')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    // The live sheet is gone with the route; its copy is still on screen.
    expect(document.body.querySelector('[data-splash-modal]')).toBeNull();
    const ghost = leaving();
    expect(ghost).not.toBeNull();
    expect(ghost!.textContent).toContain('a splash');
    expect(ghost!.getAttribute('aria-hidden')).toBe('true');
    const panel = runs.find((r) => r.target.hasAttribute('data-splash-sheet'))!;
    expect(panel.keyframes).toEqual({ y: '100%', opacity: 0 });
    expect(runs.some((r) => r.target.hasAttribute('data-sheet-scrim'))).toBe(true);
    // Unmounted only when the spring is done.
    await act(async () => {
      runs.forEach((r) => r.finish());
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(leaving()).toBeNull();
  });

  it('fades only, under reduced motion', () => {
    reducedMotion(true);
    render(<Routed />);
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    const panel = runs.find((r) => r.target.hasAttribute('data-splash-sheet'))!;
    expect(panel.keyframes).toEqual({ opacity: 0 });
  });

  it('plays nothing extra when the sheet closed itself (its own exit already ran)', async () => {
    render(<Routed />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(leaving()).toBeNull();
  });

  it('plays nothing on opening under React’s development double-run', () => {
    render(
      <StrictMode>
        <Routed />
      </StrictMode>,
    );
    expect(leaving()).toBeNull();
    expect(runs).toHaveLength(0);
  });
});
