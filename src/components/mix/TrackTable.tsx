import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type Modifier,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { cx } from '../../lib/cx';
import { noteKey } from '../../lib/plan';
import { usePlan } from '../../state/usePlan';
import { TrackRow, TrackRowOverlay } from './TrackRow';
import styles from './TrackTable.module.css';
import { TransitionLink } from './TransitionLink';

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function TrackTable({
  onOpenTrack,
  onOpenTransition,
}: {
  onOpenTrack: (id: string) => void;
  onOpenTransition: (fromId: string) => void;
}) {
  const { plan, dispatch } = usePlan();
  const { tracks, notes } = plan;
  const ids = tracks.map((t) => t.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Rows stay put while dragging; a line shows where the track will land.
  const from = activeId ? ids.indexOf(activeId) : -1;
  const to = overId ? ids.indexOf(overId) : -1;
  const dropMark = (i: number) => (from < 0 || to < 0 || from === to || i !== to ? null : to > from ? 'after' : 'before');

  const reset = () => {
    setActiveId(null);
    setOverId(null);
  };

  const title = (id: UniqueIdentifier) => `“${tracks.find((t) => t.id === id)?.title ?? 'track'}”`;
  const pos = (id: UniqueIdentifier) => `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}, ${pos(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${title(active.id)} will move to ${pos(over.id)}.` : ''),
    onDragEnd: ({ active, over }) =>
      over ? `${title(active.id)} dropped at ${pos(over.id)}.` : `${title(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Reordering cancelled. ${title(active.id)} stays at ${pos(active.id)}.`,
  };

  const active = from > -1 ? tracks[from] : null;

  return (
    <>
      <div className={styles.cols} aria-hidden="true">
        <div className={styles.num}>#</div>
        <div>Title</div>
        <div className={styles.dv}>BPM</div>
        <div className={styles.dv}>Key</div>
        <div className={cx(styles.dv, styles.time)}>
          <Clock size={16} strokeWidth={1.5} className={styles.clock} />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'To reorder, press Space or Enter to pick up the track. Use the up and down arrow keys to move it, then Space or Enter to drop it, or Escape to cancel.',
          },
        }}
        onDragStart={({ active }) => setActiveId(String(active.id))}
        onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
        onDragEnd={({ active, over }) => {
          if (over) {
            const a = ids.indexOf(String(active.id));
            const b = ids.indexOf(String(over.id));
            if (a !== b) dispatch({ type: 'move', from: a, to: b });
          }
          reset();
        }}
        onDragCancel={reset}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className={cx(styles.list, active && styles.dragging)} aria-label="Tracks">
            {tracks.map((t, i) => {
              const next = tracks[i + 1];
              return (
                <li key={t.id}>
                  <TrackRow track={t} index={i} total={tracks.length} drop={dropMark(i)} onOpen={onOpenTrack} />
                  {next && (
                    <TransitionLink
                      index={i}
                      from={t}
                      to={next}
                      rating={notes[noteKey(t.id, next.id)]?.rating ?? 0}
                      onOpen={onOpenTransition}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </SortableContext>
        <DragOverlay dropAnimation={null} modifiers={[verticalOnly]}>
          {active && <TrackRowOverlay track={active} index={from} />}
        </DragOverlay>
      </DndContext>
    </>
  );
}
