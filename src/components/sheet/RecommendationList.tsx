import { cx } from '../../lib/cx';
import { matchColor, type Recommendation } from '../../lib/recommend';
import type { Track } from '../../lib/types';
import type { CandidatesState } from '../../state/useCandidates';
import shared from '../../styles/shared.module.css';
import { Art } from '../mix/Art';
import styles from './sheetBody.module.css';

export function TrackResult({
  track,
  score,
  actionLabel,
  alwaysShowAction,
  onAction,
}: {
  track: Track;
  score?: number;
  actionLabel: string;
  alwaysShowAction?: boolean;
  onAction: () => void;
}) {
  return (
    <li className={styles.rec}>
      <Art track={track} size={36} radius={6} />
      <div className={shared.info}>
        <div className={cx(shared.title, styles.recTitle)} title={track.title}>
          {track.title}
        </div>
        <div className={shared.artist} title={track.artists}>
          {track.artists} · {track.key ?? '–'} · {track.bpm ?? '–'}
        </div>
      </div>
      {score != null && (
        <div className={styles.match} style={{ color: matchColor(score) }} aria-label={`${score}% match`}>
          {score}%
        </div>
      )}
      <button
        type="button"
        className={cx(styles.add, alwaysShowAction && styles.always)}
        title={actionLabel}
        aria-label={`${actionLabel} “${track.title}”`}
        onClick={onAction}
      >
        +
      </button>
    </li>
  );
}

export function RecommendationList({
  pool,
  recs,
  onInsert,
}: {
  pool: CandidatesState;
  recs: Recommendation[];
  onInsert: (track: Track) => void;
}) {
  if (pool.status === 'loading') return <div className={styles.none}>Finding matches…</div>;
  if (pool.status === 'error') return <div className={styles.none}>Couldn’t load suggestions.</div>;
  if (!recs.length) return <div className={styles.none}>No close matches.</div>;
  return (
    <ul className={styles.recs}>
      {recs.map((r) => (
        <TrackResult key={r.track.id} track={r.track} score={r.score} actionLabel="Insert" onAction={() => onInsert(r.track)} />
      ))}
    </ul>
  );
}
