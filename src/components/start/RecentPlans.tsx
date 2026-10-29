import { useMemo } from 'react';
import { plural, timeAgo } from '../../lib/format';
import { avgMix } from '../../lib/plan';
import { fromPlanFile } from '../../lib/planFile';
import type { PlanFileV1 } from '../../lib/types';
import shared from '../../styles/shared.module.css';
import { Art } from '../mix/Art';
import styles from './StartScreen.module.css';

const MAX_SHOWN = 6;

function meta(p: PlanFileV1): string {
  let avg: number | null = null;
  try {
    avg = avgMix(fromPlanFile(p));
  } catch {
    /* unreadable entry; show it without an average */
  }
  return [plural(p.tracks.length, 'track'), avg != null && `avg mix ${avg.toFixed(1)}`, `edited ${timeAgo(p.updated)}`]
    .filter(Boolean)
    .join(' · ');
}

export function RecentPlans({
  plans,
  onOpen,
  onRemove,
}: {
  plans: PlanFileV1[];
  onOpen: (plan: PlanFileV1) => void;
  onRemove: (id: string) => void;
}) {
  const shown = useMemo(() => plans.slice(0, MAX_SHOWN).map((p) => ({ plan: p, meta: meta(p) })), [plans]);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="recent-head">
      <h2 id="recent-head" className={styles.rhead}>
        Recent plans
      </h2>
      <ul className={styles.recentList}>
        {shown.map(({ plan, meta }) => (
          <li key={plan.id} className={styles.recent}>
            <button type="button" className={styles.option} onClick={() => onOpen(plan)}>
              <span className={styles.opticon}>
                {plan.tracks[0] ? <Art track={plan.tracks[0]} size={40} radius={0} /> : <span aria-hidden="true">♪</span>}
              </span>
              <span className={shared.info}>
                <span className={shared.title} title={plan.title}>
                  {plan.title}
                </span>
                <span className={shared.artist}>{meta}</span>
              </span>
              <span className={styles.chev} aria-hidden="true">
                ›
              </span>
            </button>
            <button
              type="button"
              className={styles.rm}
              title="Remove from recent"
              aria-label={`Remove “${plan.title}” from recent plans`}
              onClick={() => onRemove(plan.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
