// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { useAxisLock } from '@/components/ui/use-axis-lock';

afterEach(cleanup);

function Scroller() {
  const ref = useRef<HTMLDivElement>(null);
  useAxisLock(ref);
  return <div ref={ref} data-scroller style={{ overflow: 'auto' }} />;
}

const touch = (el: Element, type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0): void => {
  fireEvent[type](el, { touches: type === 'touchEnd' ? [] : [{ clientX: x, clientY: y }] });
};
const scrollTo = (el: HTMLElement, top: number, left: number): void => {
  el.scrollTop = top;
  el.scrollLeft = left;
  fireEvent.scroll(el);
};

describe('one axis per gesture (round 3)', () => {
  it('holds the vertical scroll still once a drag is decided horizontal', () => {
    const { container } = render(<Scroller />);
    const el = container.querySelector<HTMLElement>('[data-scroller]')!;
    touch(el, 'touchStart', 100, 100);
    touch(el, 'touchMove', 112, 103);
    scrollTo(el, 30, 40);
    expect(el.scrollLeft).toBe(40);
    expect(el.scrollTop).toBe(0);
  });

  it('holds the horizontal scroll still once a drag is decided vertical', () => {
    const { container } = render(<Scroller />);
    const el = container.querySelector<HTMLElement>('[data-scroller]')!;
    touch(el, 'touchStart', 100, 100);
    touch(el, 'touchMove', 103, 112);
    scrollTo(el, 50, 20);
    expect(el.scrollTop).toBe(50);
    expect(el.scrollLeft).toBe(0);
  });

  it('decides nothing within the first 8px', () => {
    const { container } = render(<Scroller />);
    const el = container.querySelector<HTMLElement>('[data-scroller]')!;
    touch(el, 'touchStart', 100, 100);
    touch(el, 'touchMove', 104, 104);
    scrollTo(el, 10, 10);
    expect(el.scrollTop).toBe(10);
    expect(el.scrollLeft).toBe(10);
  });

  it('starts each gesture undecided', () => {
    const { container } = render(<Scroller />);
    const el = container.querySelector<HTMLElement>('[data-scroller]')!;
    touch(el, 'touchStart', 100, 100);
    touch(el, 'touchMove', 120, 100);
    touch(el, 'touchEnd');
    touch(el, 'touchStart', 100, 100);
    touch(el, 'touchMove', 100, 120);
    scrollTo(el, 60, 0);
    expect(el.scrollTop).toBe(60);
  });
});
