import { cx } from '../../lib/cx';
import { recommend } from '../../lib/recommend';
import { usePlan } from '../../state/PlanContext';
import { useCandidates } from '../../state/useCandidates';
import shared from '../../styles/shared.module.css';
import { FactCard } from './FactCard';
import { RecommendationList } from './RecommendationList';
import styles from './sheetBody.module.css';
import { TrackMini } from './TrackMini';

export function TrackSheet({
  trackId,
  onShowTransition,
}: {
  trackId: string;
  onShowTransition: (fromId: string) => void;
}) {
  const { plan, dispatch } = usePlan();
  const i = plan.tracks.findIndex((t) => t.id === trackId);
  const a = plan.tracks[i];
  const pool = useCandidates(a ? [a] : []);
  if (!a) return null;
  const recs = pool.status === 'ready' ? recommend([a], pool.tracks, plan.tracks) : [];

  return (
    <>
      <div className={shared.eyebrow}>Track {i + 1}</div>
      <div className={styles.pair}>
        <TrackMini track={a} />
      </div>
      <div className={cx(styles.facts, styles.flush)}>
        <FactCard label="Key" value={a.key ?? 'Unknown'} />
        <FactCard label="Tempo" value={a.bpm ? `${a.bpm} BPM` : 'Unknown'} />
      </div>
      <div className={styles.sec}>
        <h3>Mixes well next</h3>
        <span>key · tempo · genre</span>
      </div>
      <RecommendationList
        pool={pool}
        recs={recs}
        onInsert={(t) => {
          dispatch({ type: 'insertAt', index: i + 1, track: t });
          onShowTransition(a.id);
        }}
      />
    </>
  );
}
