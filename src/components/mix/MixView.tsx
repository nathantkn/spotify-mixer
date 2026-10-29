import { useRef, useState } from 'react';
import { downloadText } from '../../lib/download';
import { plural } from '../../lib/format';
import { avgMix, totalSeconds } from '../../lib/plan';
import { planFileName, serializePlan, toPlanFile } from '../../lib/planFile';
import type { PlanSession } from '../../state/session';
import { usePlan } from '../../state/PlanContext';
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

type SheetView = { kind: 'transition'; fromId: string } | { kind: 'track'; id: string } | { kind: 'add' };

export function MixView({ session, onExit }: { session: PlanSession; onExit: () => void }) {
  const { plan, saveStatus, saveNow } = usePlan();
  useTrackEnrichment();
  // The view outlives `open` so the content stays put while the sheet slides out.
  const [view, setView] = useState<SheetView | null>(null);
  const [open, setOpen] = useState(false);
  const [opens, setOpens] = useState(0);
  const trigger = useRef<HTMLElement | null>(null);

  const show = (v: SheetView) => {
    // Captured now, before the page behind the sheet goes inert.
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setView(v);
    setOpen(true);
    setOpens((c) => c + 1);
  };

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
          <TrackSheet trackId={view.id} onShowTransition={(fromId) => setView({ kind: 'transition', fromId })} />
        )}
        {/* Keyed so the search and form start fresh each time the sheet opens. */}
        {view?.kind === 'add' && <AddSongSheet key={opens} />}
      </Sheet>
    </>
  );
}
