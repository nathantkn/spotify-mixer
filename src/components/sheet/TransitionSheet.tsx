import { cx } from '../../lib/cx';
import { noteKey } from '../../lib/plan';
import { RATING_LABELS, RATINGS, ratingColor } from '../../lib/rating';
import { recommend } from '../../lib/recommend';
import { OK_COLORS, pairScore, tempoFact } from '../../lib/scoring';
import type { TransitionNote } from '../../lib/types';
import { usePlan } from '../../state/usePlan';
import { useCandidates } from '../../state/useCandidates';
import shared from '../../styles/shared.module.css';
import { FactCard } from './FactCard';
import { RecommendationList } from './RecommendationList';
import styles from './sheetBody.module.css';
import { TrackMini } from './TrackMini';

const UNRATED: TransitionNote = { rating: 0, text: '' };

/** The transition from `fromId` to whatever track currently follows it. */
export function TransitionSheet({ fromId }: { fromId: string }) {
  const { plan, dispatch } = usePlan();
  const i = plan.tracks.findIndex((t) => t.id === fromId);
  const a = plan.tracks[i];
  const b = plan.tracks[i + 1];
  const { state: pool, find } = useCandidates(a && b ? [a, b] : []);
  if (!a || !b) return null;

  const note = plan.notes[noteKey(a.id, b.id)] ?? UNRATED;
  const { key, bpm } = pairScore(a, b);
  const recs = pool.status === 'ready' ? recommend([a, b], pool.tracks, plan.tracks) : [];

  return (
    <>
      <div className={shared.eyebrow}>Transition {i + 1}</div>
      <div className={styles.pair}>
        <TrackMini track={a} />
        <div className={styles.arrow} aria-label="into">
          ↓
        </div>
        <TrackMini track={b} />
      </div>

      <div className={styles.stars} role="group" aria-label="How did it mix?">
        {RATINGS.map((k) => {
          const on = k <= note.rating;
          return (
            <button
              key={k}
              type="button"
              className={cx(styles.star, on && styles.on)}
              style={on ? { background: ratingColor(note.rating) } : undefined}
              aria-pressed={k === note.rating}
              aria-label={`Rate ${k} of 5, ${RATING_LABELS[k]}`}
              onClick={() =>
                dispatch({ type: 'setRating', from: a.id, to: b.id, rating: note.rating === k ? 0 : k })
              }
            >
              {k}
            </button>
          );
        })}
      </div>
      <div className={styles.ratelbl} aria-live="polite">
        {note.rating ? RATING_LABELS[note.rating] : 'How did it mix?'}
      </div>

      <textarea
        className={styles.note}
        aria-label="Transition notes"
        placeholder="Notes — cue points, EQ, what to try next time"
        value={note.text}
        onChange={(e) => dispatch({ type: 'setNote', from: a.id, to: b.id, text: e.target.value })}
      />

      <div className={styles.facts}>
        <FactCard label="Key" value={`${a.key ?? '–'} → ${b.key ?? '–'}`} sub={key.label} subColor={OK_COLORS[key.ok]} />
        <FactCard
          label="Tempo"
          value={`${a.bpm ?? '–'} → ${b.bpm ?? '–'}`}
          sub={tempoFact(bpm)}
          subColor={bpm.unknown ? 'var(--mut)' : OK_COLORS[bpm.ok]}
        />
      </div>

      <div className={styles.sec}>
        <h3>Bridge tracks</h3>
        <span>fits between both</span>
      </div>
      {/* Inserting puts the track between A and B; this sheet then shows A → new track. */}
      <RecommendationList
        state={pool}
        recs={recs}
        targets={[a, b]}
        onFind={find}
        onInsert={(t) => dispatch({ type: 'insertAt', index: i + 1, track: t })}
      />
    </>
  );
}
