'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';

import { AnnotationControl } from '@/features/input-sheet/annotation-control';
import {
  annotationVerdict,
  draftFrom,
  spanIsEmpty,
  spanKeys,
  type Annotation,
} from '@/features/input-sheet/draft';
import { LaneChips } from '@/features/input-sheet/lane-chips';
import {
  AddImageAffordance,
  MediaPreviews,
  useMediaAttach,
} from '@/features/input-sheet/media-field';
import type { MyCategory } from '@/lib/queries/profile';
import type { RippleWithCategory } from '@/lib/queries/ripples';
import { wallClockToInstant } from '@/lib/ripple-kind';
import type { IsoDate } from '@/lib/time';

export type EditorTarget =
  { kind: 'edit'; block: RippleWithCategory; locked: boolean } | { kind: 'add'; splashId: string };

/** What the editor hands back: the block as it should now be, with a fresh id when it is new. */
export type BlockDraft = {
  id: string;
  categoryId: string | null;
  note: string;
  media: string[];
  occurredOn: IsoDate | null;
  occurredTime: string | null;
  startInstant: string | null;
  endInstant: string | null;
};

/**
 * A block, edited in place on the post's page (SPEC 5, H21): blog-editor
 * style, no sheet. The cursor goes into the words; the lane chips, `+ Add
 * Time`, `+ Add Image`, the lock toggle and Delete sit beneath them; Cancel
 * and Save close it. A new block starts at the post's declared lane and, with
 * no annotation, rests at its declared date (H21f).
 *
 * The editor only describes the change; the page applies it optimistically
 * and runs the action (CLAUDE.md, the principle).
 */
export function BlockEditor({
  target,
  categories,
  defaultLaneId,
  laneless = false,
  timeZone,
  today,
  onSubmit,
  onDelete,
  onLock,
  onCancel,
}: {
  target: EditorTarget;
  categories: MyCategory[];
  /** The post's declared lane, where a new block starts (H21f). */
  defaultLaneId: string | null;
  /** A Just-mine splash (0014): its blocks take no lane of mine, so no lane chips. */
  laneless?: boolean;
  timeZone: string;
  today: IsoDate;
  onSubmit: (draft: BlockDraft) => void;
  onDelete: () => void;
  onLock: (locked: boolean) => void;
  onCancel: () => void;
}) {
  const editing = target.kind === 'edit' ? target.block : null;
  const draft = editing ? draftFrom(editing, timeZone) : null;
  const [note, setNote] = useState(draft?.note ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? defaultLaneId);
  const [annotation, setAnnotation] = useState<Annotation | null>(draft?.annotation ?? null);
  const [media, setMedia] = useState<string[]>(draft?.media ?? []);
  const [locked, setLocked] = useState(target.kind === 'edit' ? target.locked : false);
  const [confirming, setConfirming] = useState(false);
  const attach = useMediaAttach(media, setMedia);
  const field = useRef<HTMLTextAreaElement>(null);

  // The words grow the field; the field never scrolls inside the page.
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.scrollHeight > 0) el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  const hasContent = note.trim().length > 0 || media.length > 0;
  const annotationOk = !annotation || annotationVerdict(annotation) === 'ok';

  function submit(): void {
    const a = annotation;
    const startInstant =
      a && a.time ? wallClockToInstant(a.date, a.time, timeZone).toISOString() : null;
    const span = a && !spanIsEmpty(a) ? spanKeys(a) : null;
    const endInstant = span?.end
      ? wallClockToInstant(span.end.slice(0, 10), span.end.slice(11), timeZone).toISOString()
      : null;
    onSubmit({
      id: editing?.id ?? crypto.randomUUID(),
      categoryId,
      note,
      media,
      occurredOn: a?.date ?? null,
      occurredTime: a?.time ?? null,
      startInstant,
      endInstant,
    });
  }

  return (
    <div data-block-editor={editing?.id ?? 'new'} className="flex flex-col gap-3 py-2">
      <textarea
        ref={field}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Drop your words here"
        rows={3}
        autoFocus
        aria-label="Block"
        data-block-field
        className="text-ink placeholder:text-ink min-h-20 w-full resize-none overflow-hidden text-[15px]/[1.65] outline-none placeholder:opacity-20"
      />

      {laneless ? null : (
        <LaneChips
          categories={categories}
          selectedId={categoryId}
          onSelect={setCategoryId}
          surface="white"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AnnotationControl annotation={annotation} today={today} onChange={setAnnotation} />
        <AddImageAffordance attach={attach.attach} busy={attach.busy} input={attach.input} />
      </div>

      <MediaPreviews
        paths={media}
        previews={attach.previews}
        failed={attach.failed}
        onChange={setMedia}
      />

      <div className="flex items-center gap-3 text-sm">
        {editing ? (
          <>
            {/* Everyone / Only me: one spectrum, and the lock is one end of
                it (C8). It lives beside the block, where it is edited (H21). */}
            <button
              type="button"
              aria-pressed={locked}
              onClick={() => {
                const next = !locked;
                setLocked(next);
                onLock(next);
              }}
              className="text-pool-500 flex items-center gap-1"
            >
              {locked ? <Lock aria-hidden size={13} /> : <Unlock aria-hidden size={13} />}
              {locked ? 'Only me' : 'Everyone'}
            </button>

            {confirming ? (
              <span className="flex items-center gap-2">
                <span className="text-pool-500">Deletes this block</span>
                <button type="button" onClick={onDelete} className="text-main-900 font-medium">
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-pool-500"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-pool-500">
                Delete
              </button>
            )}
          </>
        ) : null}

        <span className="flex-1" />

        <button type="button" onClick={onCancel} className="text-pool-500">
          Cancel
        </button>
        <button
          type="button"
          disabled={!hasContent || !annotationOk}
          onClick={submit}
          className="bg-main-900 rounded-full px-4 py-1.5 font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
