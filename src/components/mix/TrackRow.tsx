import { useSortable } from '@dnd-kit/sortable';
import type { KeyboardEventHandler, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { fmtDuration } from '../../lib/format';
import type { Track } from '../../lib/types';
import shared from '../../styles/shared.module.css';
import { Art } from './Art';
import { KeyTag } from './KeyTag';
import styles from './TrackTable.module.css';

function TrackSummary({ track }: { track: Track }) {
  return (
    <>
      <Art track={track} />
      <span className={shared.info}>
        <span className={shared.title} title={track.title}>
          {track.title}
        </span>
        <span className={shared.artist} title={track.artists}>
          {track.artists}
        </span>
      </span>
    </>
  );
}

function Cells({ track, num, summary }: { track: Track; num: ReactNode; summary: ReactNode }) {
  return (
    <>
      <div className={styles.num}>{num}</div>
      {summary}
      <div className={styles.bpm}>{track.bpm ?? '–'}</div>
      <div>
        <KeyTag value={track.key} />
      </div>
      <div className={styles.time}>{fmtDuration(track.dur)}</div>
    </>
  );
}

const NumAndGrip = ({ n }: { n: number }) => (
  <>
    <span className={styles.n}>{n}</span>
    <span className={styles.grip} aria-hidden="true">
      ⋮⋮
    </span>
  </>
);

export function TrackRow({
  track,
  index,
  total,
  drop,
  onOpen,
}: {
  track: Track;
  index: number;
  total: number;
  drop: 'before' | 'after' | null;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id: track.id });
  // Mouse and touch drag from anywhere on the row; the keyboard drags from the grip.
  const { onKeyDown, ...pointerListeners } = listeners ?? {};

  return (
    <div
      ref={setNodeRef}
      className={cx(
        styles.track,
        isDragging && styles.isDragging,
        drop === 'before' && styles.dropBefore,
        drop === 'after' && styles.dropAfter,
      )}
      {...pointerListeners}
    >
      <Cells
        track={track}
        num={
          <button
            ref={setActivatorNodeRef}
            type="button"
            className={styles.handle}
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
            // A mouse click on the number opens the track, like the rest of the row.
            onClick={(e) => e.detail > 0 && onOpen(track.id)}
            title="Drag to reorder"
            aria-label={`Reorder “${track.title}”, position ${index + 1} of ${total}`}
          >
            <NumAndGrip n={index + 1} />
          </button>
        }
        summary={
          <button type="button" className={styles.open} onClick={() => onOpen(track.id)}>
            <TrackSummary track={track} />
          </button>
        }
      />
    </div>
  );
}

/** What follows the pointer while dragging. */
export function TrackRowOverlay({ track, index }: { track: Track; index: number }) {
  return (
    <div className={cx(styles.track, styles.overlay)}>
      <Cells
        track={track}
        num={<NumAndGrip n={index + 1} />}
        summary={
          <span className={styles.open}>
            <TrackSummary track={track} />
          </span>
        }
      />
    </div>
  );
}
