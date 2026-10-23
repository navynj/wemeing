'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import type { IsoDate } from '@/lib/time';

import { annotationVerdict, type Annotation } from './draft';

/**
 * `+ Add Time` (H20c): an `occurred` annotation for **not-now only**. Unset
 * is the default and means a plain posted fragment; there is no *now*
 * option, because occurred = now says nothing that posting did not already.
 *
 * Tapping it places the fragment on today, as one chip that is also the
 * editor — a date, and `+ add time` inside the chip for the optional clock.
 * Time is never required: a date alone is a date-only fragment. Outside the
 * chip, `+ add end date` makes a span, by dates alone or, when the start has
 * a clock, with an end clock too; validated only as end after start. There
 * is no Done: what the chip shows is what will be committed.
 */
export function AnnotationControl({
  annotation,
  today,
  onChange,
  clock = true,
  label = '+ Add Time',
}: {
  annotation: Annotation | null;
  today: IsoDate;
  onChange: (next: Annotation | null) => void;
  /** False for a splash's own dates, which are days with no clock (H21f). */
  clock?: boolean;
  label?: string;
}) {
  // The clock field is shown once asked for, even while still empty.
  const [clockOpen, setClockOpen] = useState(annotation?.time !== null);

  if (!annotation) {
    return (
      <QuietAffordance
        onClick={() => {
          setClockOpen(false);
          onChange({ date: today, time: null, endDate: null, endTime: null });
        }}
        label={label}
      />
    );
  }

  const set = (patch: Partial<Annotation>): void => onChange({ ...annotation, ...patch });
  const verdict = annotationVerdict(annotation);
  const field = 'text-ink rounded bg-white px-1 py-px tabular-nums';

  return (
    <span data-annotation-picker className="flex flex-wrap items-center gap-2">
      <span
        data-annotation-chip
        className="bg-pool-100 text-pool-500 inline-flex h-[23px] items-center gap-1 rounded-[5px] px-1.5 text-[10px] tabular-nums"
      >
        <input
          type="date"
          lang="en"
          aria-label="Date"
          value={annotation.date}
          onChange={(event) => event.target.value && set({ date: event.target.value })}
          className={field}
        />
        {!clock ? null : clockOpen || annotation.time !== null ? (
          <input
            type="time"
            lang="en"
            aria-label="Time"
            value={annotation.time ?? ''}
            onChange={(event) =>
              set({
                time: event.target.value || null,
                // An end clock only makes sense against a start clock.
                ...(event.target.value ? {} : { endTime: null }),
              })
            }
            className={field}
          />
        ) : (
          <button type="button" onClick={() => setClockOpen(true)} className="text-main-900">
            + add time
          </button>
        )}
        <button type="button" aria-label="Remove the time" onClick={() => onChange(null)}>
          <X aria-hidden size={11} />
        </button>
      </span>

      {annotation.endDate === null ? (
        <QuietAffordance
          onClick={() => set({ endDate: annotation.date, endTime: annotation.time })}
          label="+ add end date"
        />
      ) : (
        <span
          data-annotation-end
          className="bg-pool-100 text-pool-500 inline-flex h-[23px] items-center gap-1 rounded-[5px] px-1.5 text-[10px] tabular-nums"
        >
          <span aria-hidden>~</span>
          <input
            type="date"
            lang="en"
            aria-label="End date"
            value={annotation.endDate}
            onChange={(event) => event.target.value && set({ endDate: event.target.value })}
            className={field}
          />
          {annotation.time !== null ? (
            <input
              type="time"
              lang="en"
              aria-label="End time"
              value={annotation.endTime ?? ''}
              onChange={(event) => set({ endTime: event.target.value || null })}
              className={field}
            />
          ) : null}
          <button
            type="button"
            aria-label="Remove the end"
            onClick={() => set({ endDate: null, endTime: null })}
          >
            <X aria-hidden size={11} />
          </button>
        </span>
      )}

      {verdict === 'backwards' ? (
        <span role="alert" className="text-pool-500 text-xs">
          ends before it starts
        </span>
      ) : null}
    </span>
  );
}

/** The two small grey pills under the note field, per the mockup. */
export function QuietAffordance({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bg-pool-100 text-pool-500 h-[23px] rounded-[5px] px-2.5 text-[10px] disabled:opacity-50"
    >
      {label}
    </button>
  );
}
