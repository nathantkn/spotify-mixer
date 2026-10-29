import { useEffect, useState } from 'react';
import { CSV_TEMPLATE } from '../../lib/csv';
import { downloadText } from '../../lib/download';
import type { ImportResult } from '../../lib/importFile';
import { emptyPlan } from '../../lib/plan';
import { fromPlanFile, toPlanFile } from '../../lib/planFile';
import { samplePlan } from '../../lib/sample';
import { planStorage } from '../../state/planStorage';
import { createSession, type PlanSession } from '../../state/session';
import shared from '../../styles/shared.module.css';
import { DropZone } from './DropZone';
import { RecentPlans } from './RecentPlans';
import styles from './StartScreen.module.css';

export function StartScreen({ onOpen }: { onOpen: (session: PlanSession) => void }) {
  const [plans, setPlans] = useState(() => planStorage.list());

  // A file dropped beside the drop zone shouldn't navigate the browser away.
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  function handleImport({ kind, plan }: ImportResult) {
    if (kind === 'json') {
      planStorage.put(toPlanFile(plan)); // saved right away; overwrites a stored plan with the same id
      onOpen(createSession(plan, { saveOnOpen: false }));
    } else {
      onOpen(createSession(plan, { saveOnOpen: true, fromCsv: true }));
    }
  }

  return (
    <main className={styles.start}>
      <div className={shared.eyebrow}>Mix Planner</div>
      <h1 className={styles.h1}>Plan your next mix</h1>
      <p className={styles.sub}>Start from a playlist export or build one song at a time.</p>

      <DropZone onImport={handleImport} />

      <div className={shared.divider}>or</div>

      <RecentPlans
        plans={plans}
        onOpen={(p) => onOpen(createSession(fromPlanFile(p), { saveOnOpen: false }))}
        onRemove={(id) => {
          planStorage.remove(id);
          setPlans(planStorage.list());
        }}
      />

      <button
        type="button"
        className={styles.option}
        onClick={() => onOpen(createSession(emptyPlan(), { saveOnOpen: true, focusTitle: true }))}
      >
        <span className={styles.opticon} aria-hidden="true">
          +
        </span>
        <span className={shared.info}>
          <span className={shared.title}>Start from scratch</span>
          <span className={shared.artist}>Empty mix — search or add songs manually</span>
        </span>
        <span className={styles.chev} aria-hidden="true">
          ›
        </span>
      </button>

      <div className={styles.links}>
        <button type="button" onClick={() => onOpen(createSession(samplePlan(), { saveOnOpen: true }))}>
          Try a sample mix
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => downloadText(CSV_TEMPLATE, 'mix-template.csv', 'text/csv')}>
          Download CSV template
        </button>
      </div>
    </main>
  );
}
