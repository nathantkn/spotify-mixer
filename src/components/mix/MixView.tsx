import { useRef, useState } from 'react';
import { downloadText } from '../../lib/download';
import { plural } from '../../lib/format';
import { avgMix, totalSeconds } from '../../lib/plan';
import { planFileName, serializePlan, toPlanFile } from '../../lib/planFile';
import type { Track } from '../../lib/types';
import type { PlanSession } from '../../state/session';
import { usePlan } from '../../state/usePlan';
import { useSpotifyMatching } from '../../state/useSpotifyMatching';
import { useTrackEnrichment } from '../../state/useTrackEnrichment';
import shared from '../../styles/shared.module.css';
import { AddSongSheet } from '../sheet/AddSongSheet';
import { Sheet } from '../sheet/Sheet';
import { TrackSheet } from '../sheet/TrackSheet';
import { TransitionSheet } from '../sheet/TransitionSheet';
import { AddSongRow } from './AddSongRow';
import styles from './MixView.module.css';
import { PlanTitle } from './PlanTitle';
import { TopBar } from './TopBar';
import { TrackTable } from './TrackTable';
import { UndoToast } from './UndoToast';

type SheetView = { kind: 'transition'; fromId: string } | { kind: 'track'; id: string } | { kind: 'add' };

export function MixView({ session, onExit }: { session: PlanSession; onExit: () => void }) {
  const { plan, dispatch, saveStatus, saveNow } = usePlan();
  useTrackEnrichment();
  const matching = useSpotifyMatching();
  // The view outlives `open` so the content stays put while the sheet slides out.
  const [view, setView] = useState<SheetView | null>(null);
  const [open, setOpen] = useState(false);
  const [opens, setOpens] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);
  const [removed, setRemoved] = useState<{ track: Track; index: number; n: number } | null>(null);

  const show = (v: SheetView) => {
    // Captured now, before the page behind the sheet goes inert.
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setView(v);
    setOpen(true);
    setOpens((c) => c + 1);
  };

  function removeTrack(track: Track, index: number) {
    setOpen(false);
    dispatch({ type: 'remove', id: track.id });
    setRemoved((r) => ({ track, index, n: (r?.n ?? 0) + 1 }));
  }

  /** Keyboard focus goes to the track now in that spot, or the Add song row. */
  function focusNear(index: number, tracks: Track[]) {
    requestAnimationFrame(() => {
      const t = tracks[Math.min(index, tracks.length - 1)];
      const el = (t && document.querySelector<HTMLElement>(`[data-track-open="${CSS.escape(t.id)}"]`)) ??
        document.querySelector<HTMLElement>('[data-add-song]');
      el?.focus({ preventScroll: true });
    });
  }

  function undoRemove() {
    if (!removed) return;
    // Notes are keyed by track pair and kept in memory, so putting it back restores its transitions.
    dispatch({ type: 'insertAt', index: removed.index, track: removed.track });
    const id = removed.track.id;
    setRemoved(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-track-open="${CSS.escape(id)}"]`)?.focus());
  }

  function exportPlan() {
    saveNow();
    const file = toPlanFile(plan);
    downloadText(serializePlan(file), planFileName(file.title), 'application/json');
  }

  const n = plan.tracks.length;
  const avg = avgMix(plan);
  const missing = session.fromCsv ? plan.tracks.filter((t) => !t.bpm || !t.key).length : 0;
  const subline = n
    ? [
        plural(n, 'track'),
        `${Math.round(totalSeconds(plan.tracks) / 60)} min`,
        avg != null && `avg mix ${avg.toFixed(1)}`,
        missing > 0 && `${missing} missing BPM or key`,
        matching && `matching Spotify ${matching.done}/${matching.total}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'No tracks yet';

  const indexOf = (id: string) => plan.tracks.findIndex((t) => t.id === id) + 1;
  const label =
    view?.kind === 'transition' ? `Transition ${indexOf(view.fromId)}` : view?.kind === 'track' ? `Track ${indexOf(view.id)}` : 'Add a song';

  return (
    <>
      <main className={styles.wrap} inert={open}>
        <TopBar
          status={saveStatus}
          onBack={() => {
            saveNow();
            onExit();
          }}
          onExport={exportPlan}
        />
        <div className={shared.eyebrow}>Mix plan</div>
        <PlanTitle autoFocus={session.focusTitle} />
        <p className={styles.sub}>{subline}</p>

        {n ? (
          <TrackTable
            onOpenTrack={(id) => show({ kind: 'track', id })}
            onOpenTransition={(fromId) => show({ kind: 'transition', fromId })}
          />
        ) : (
          <div className={styles.empty}>
            <b>Your mix is empty</b>
            Add your first song to get started.
          </div>
        )}
        <AddSongRow onClick={() => show({ kind: 'add' })} />
      </main>

      <Sheet open={open} label={label} returnFocus={trigger} onClose={() => setOpen(false)}>
        {view?.kind === 'transition' && <TransitionSheet fromId={view.fromId} />}
        {view?.kind === 'track' && (
          <TrackSheet
            trackId={view.id}
            onShowTransition={(fromId) => setView({ kind: 'transition', fromId })}
            onRemove={removeTrack}
          />
        )}
        {/* Keyed so the search and form start fresh each time the sheet opens. */}
        {view?.kind === 'add' && <AddSongSheet key={opens} />}
      </Sheet>

      {removed && (
        <UndoToast
          key={removed.n}
          message={`Removed “${removed.track.title}”`}
          onUndo={undoRemove}
          onDone={(hadFocus) => {
            const { index } = removed;
            setRemoved(null);
            if (hadFocus) focusNear(index, plan.tracks);
          }}
        />
      )}
    </>
  );
}
