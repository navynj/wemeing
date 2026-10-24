'use client';

import { useRef } from 'react';

import { clampView, type CropView } from './crop';

/** The frame's side on screen; the file is drawn at 512 whatever this is. */
export const FRAME_PX = 224;

/**
 * The crop: the picked photo in a square, a round mask over it for the face
 * it will become, dragged to move and zoomed with the slider.
 */
export function CropFrame({
  image,
  view,
  onChange,
  shape = 'circle',
}: {
  image: HTMLImageElement;
  view: CropView;
  onChange: (view: CropView) => void;
  /** The face it will become: a person's circle, or a pool's rounded square (0024). */
  shape?: 'circle' | 'square';
}) {
  const drag = useRef<{ x: number; y: number; from: CropView } | null>(null);
  const size = { width: image.naturalWidth, height: image.naturalHeight };
  const shown = clampView(view, size, FRAME_PX);
  const scale = Math.max(FRAME_PX / size.width, FRAME_PX / size.height) * shown.zoom;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        data-crop-frame
        className="relative touch-none overflow-hidden rounded-2xl bg-black select-none"
        style={{ width: FRAME_PX, height: FRAME_PX }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, from: shown };
        }}
        onPointerMove={(event) => {
          const from = drag.current;
          if (!from) return;
          onChange(
            clampView(
              {
                ...from.from,
                x: from.from.x + event.clientX - from.x,
                y: from.from.y + event.clientY - from.y,
              },
              size,
              FRAME_PX,
            ),
          );
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: size.width * scale,
            height: size.height * scale,
            left: FRAME_PX / 2 + shown.x - (size.width * scale) / 2,
            top: FRAME_PX / 2 + shown.y - (size.height * scale) / 2,
          }}
        />
        {/* The face it will become: everything outside the circle dimmed. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${
            shape === 'circle' ? 'rounded-full' : 'rounded-[18%]'
          }`}
          style={{ boxShadow: '0 0 0 999px rgb(0 0 0 / 0.45)' }}
        />
      </div>
      <input
        type="range"
        min={1}
        max={4}
        step={0.01}
        value={shown.zoom}
        aria-label="Zoom"
        onChange={(event) =>
          onChange(clampView({ ...shown, zoom: Number(event.target.value) }, size, FRAME_PX))
        }
        className="accent-main-900 w-48"
      />
    </div>
  );
}
