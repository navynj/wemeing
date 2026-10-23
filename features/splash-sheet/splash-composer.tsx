'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import { AnnotationControl } from '@/features/input-sheet/annotation-control';
import {
  annotationVerdict,
  spanIsEmpty,
  spanKeys,
  type Annotation,
} from '@/features/input-sheet/draft';
import { LaneChips } from '@/features/input-sheet/lane-chips';
import { EmojiInput } from '@/features/lanes/emoji-input';
import {
  AddImageAffordance,
  MediaPreviews,
  useMediaAttach,
} from '@/features/input-sheet/media-field';
import { dropSplash, type SplashResult } from '@/features/splash/actions';
import { summarizeSplash, type SplashSummary } from '@/features/splash/summary';
import type { MyCategory } from '@/lib/queries/profile';
import { wallClockToInstant } from '@/lib/ripple-kind';
import type { IsoDate } from '@/lib/time';

import { composeDrop } from './split-title';

export type SheetContext = {
  categories: MyCategory[];
  timeZone: string;
  today: IsoDate;
};

/** A drop as the composer hands it over: the post as the screen should show it, and the action that makes it true. */
export type DropHandoff = {
  splash: SplashSummary;
  month: string;
  /** The first block's words, for the recent column to preview at once. */
  note: string | null;
  commit: () => Promise<SplashResult>;
};

/** An IME is mid-composition: Chrome flags it, Safari reports keyCode 229. */
function isComposing(event: React.KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

/**
 * The composer (SPEC 6, H21, review): a large bold blue title field over a
 * smaller, lighter body field — the first line is still the title and Enter
 * still moves on to the body — the lane chip row (the declared lane), the
 * date chip preset to today, `+ Add Image`, and one full-width Drop. The
 * same form inside the phone's bottom sheet and the wide screen's standing
 * panel.
 *
 * Drop hands over at once (CLAUDE.md, the principle): the post as the
 * ground should show it, its month, and the action that makes it real. The
 * fields clear the moment it is handed over.
 */
export function SplashComposer({
  context,
  onDrop,
  autoFocus = true,
}: {
  context: SheetContext;
  onDrop: (drop: DropHandoff) => void;
  autoFocus?: boolean;
}) {
  const { categories, timeZone, today } = context;
  const fresh = (): Annotation => ({ date: today, time: null, endDate: null, endTime: null });
  const [titleText, setTitleText] = useState('');
  // The post's own icon (0008); empty lets the lane's emoji stand for it.
  const [icon, setIcon] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [laneId, setLaneId] = useState<string | null>(null);
  // Today is in the field from the start (review): the chip opens set to the
  // date, no clock, and is removed with its × for a plain posted block.
  const [annotation, setAnnotation] = useState<Annotation | null>(fresh);
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const media = useMediaAttach(mediaPaths, setMediaPaths);
  const field = useRef<HTMLTextAreaElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);

  // The fields grow with their words; the sheet's cap does the clipping.
  useLayoutEffect(() => {
    for (const el of [field.current, bodyField.current]) {
      if (!el) continue;
      el.style.height = 'auto';
      if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
    }
  }, [titleText, bodyText]);

  const { title, body } = composeDrop(titleText, bodyText);
  const hasContent =
    title.length > 0 || body.length > 0 || mediaPaths.length > 0 || laneId !== null;
  const annotationOk = !annotation || annotationVerdict(annotation) === 'ok';

  function drop(): void {
    const a = annotation;
    const startInstant =
      a && a.time ? wallClockToInstant(a.date, a.time, timeZone).toISOString() : null;
    const span = a && !spanIsEmpty(a) ? spanKeys(a) : null;
    const endInstant = span?.end
      ? wallClockToInstant(span.end.slice(0, 10), span.end.slice(11), timeZone).toISOString()
      : null;
    const id = crypto.randomUUID();
    const now = new Date();
    const input = {
      id,
      title,
      body,
      media: mediaPaths,
      declaredStart: null,
      declaredEnd: null,
      declaredLaneId: laneId,
      icon: icon || null,
      occurredOn: a?.date ?? null,
      occurredTime: a?.time ?? null,
      startInstant,
      endInstant,
      sessionId: null,
    };

    // The post as the ground should show it, summarised the way the page
    // summarises a real one.
    const hasBlock = body.length > 0 || mediaPaths.length > 0;
    const splash = summarizeSplash(
      {
        id,
        owner_id: '',
        title,
        declared_start: null,
        declared_end: null,
        declared_lane_id: laneId,
        icon: icon || null,
        session_id: null,
        pinned_at: null,
        pool_id: null,
        pool_lane_id: null,
        created_by: null,
        type: 'free',
        prompt: null,
        ends_at: null,
        created_at: now.toISOString(),
      },
      hasBlock
        ? [
            {
              id: `${id}-first`,
              category_id: laneId ?? '',
              note: body.length > 0 ? body : null,
              occurred_on: a?.date ?? null,
              occurred_time: a?.time ? `${a.time}:00` : null,
              ended_at: endInstant ?? startInstant,
              created_at: now.toISOString(),
            },
          ]
        : [],
      timeZone,
      now,
    );

    onDrop({
      splash,
      month: (a?.date ?? today).slice(0, 7),
      note: body.length > 0 ? body : null,
      commit: () => dropSplash(input),
    });

    setTitleText('');
    setIcon('');
    setBodyText('');
    setLaneId(null);
    setAnnotation(fresh());
    setMediaPaths([]);
    field.current?.focus();
  }

  return (
    <div data-splash-composer className="flex flex-col gap-5">
      {/* The title, large and bold; Enter moves on to the body, so the
          first line is still the title and the rest still follows it.
          Not while an IME is composing (Korean, say): that Enter commits
          the character, and moving focus on it would carry the character
          into the body. */}
      <div className="flex items-start gap-3">
        {/* The post's own icon: one glyph from the phone's emoji keyboard,
          shown large; left empty, the lane's emoji stands for the post. */}
        <EmojiInput
          value={icon}
          onChange={setIcon}
          label="Icon"
          placeholder={categories.find((c) => c.id === laneId)?.icon ?? '🙂'}
        />
        <textarea
          ref={field}
          value={titleText}
          onChange={(event) => setTitleText(event.target.value.replace(/\n/g, ''))}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (isComposing(event)) return;
            bodyField.current?.focus();
          }}
          placeholder="Drop your splash"
          rows={1}
          autoFocus={autoFocus}
          aria-label="Title"
          data-sheet-title
          className="text-main-900 placeholder:text-main-900 min-w-0 flex-1 resize-none text-3xl/snug font-semibold outline-none placeholder:opacity-20"
        />
      </div>
      {/* Backspace at the very start of the body walks the cursor back up
          to the end of the title, the way a notes app does. */}
      <textarea
        ref={bodyField}
        value={bodyText}
        onChange={(event) => setBodyText(event.target.value)}
        onKeyDown={(event) => {
          const el = event.currentTarget;
          if (event.key !== 'Backspace' || el.selectionStart !== 0 || el.selectionEnd !== 0) return;
          if (isComposing(event)) return;
          event.preventDefault();
          const title = field.current;
          if (!title) return;
          title.focus();
          title.setSelectionRange(title.value.length, title.value.length);
        }}
        placeholder="Enter the content"
        rows={2}
        aria-label="Content"
        data-sheet-body
        className="text-ink placeholder:text-ink min-h-12 w-full resize-none text-base/relaxed font-light outline-none placeholder:opacity-20"
      />

      {/* The declared lane: where every block of this post starts (H21f). */}
      <LaneChips categories={categories} selectedId={laneId} onSelect={setLaneId} surface="white" />

      <div className="flex flex-wrap items-center gap-2">
        <AnnotationControl annotation={annotation} today={today} onChange={setAnnotation} />
        <AddImageAffordance attach={media.attach} busy={media.busy} input={media.input} />
      </div>

      <MediaPreviews
        paths={mediaPaths}
        previews={media.previews}
        failed={media.failed}
        onChange={setMediaPaths}
      />

      {/* Blue means action: the one filled thing here commits (H20f). */}
      <button
        type="button"
        disabled={!hasContent || !annotationOk}
        onClick={drop}
        className="bg-main-900 w-full rounded-full py-2.5 text-xl font-medium text-white disabled:opacity-50"
      >
        Drop
      </button>
    </div>
  );
}
