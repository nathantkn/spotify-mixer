import { ChevronDown, LoaderCircle, Plus, Sparkles } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { matchColor, type Recommendation } from '../../lib/recommend';
import { OK_COLORS, pairPoints, tempoFact, WEIGHTS, type PairScore } from '../../lib/scoring';
import type { Track } from '../../lib/types';
import type { CandidatesState } from '../../state/useCandidates';
import shared from '../../styles/shared.module.css';
import { Art } from '../mix/Art';
import styles from './sheetBody.module.css';

export function TrackResult({
  track,
  score,
  breakdown,
  actionLabel,
  alwaysShowAction,
  onAction,
}: {
  track: Track;
  score?: number;
  /** Shown under the row when the match % is clicked. */
  breakdown?: ReactNode;
  actionLabel: string;
  alwaysShowAction?: boolean;
  onAction: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li>
      <div className={styles.rec}>
        <Art track={track} size={36} radius={6} />
        <div className={shared.info}>
          <div className={cx(shared.title, styles.recTitle)} title={track.title}>
            {track.title}
          </div>
          <div className={shared.artist} title={track.artists}>
            {track.artists} · {track.key ?? '–'} · {track.bpm ?? '–'}
          </div>
        </div>
        {score != null &&
          (breakdown ? (
            <button
              type="button"
              className={styles.match}
              style={{ color: matchColor(score) }}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${score}% match. ${open ? 'Hide' : 'Show'} how it's scored`}
              title="How this match is scored"
              onClick={() => setOpen((o) => !o)}
            >
              {score}%
              <ChevronDown size={12} strokeWidth={2.5} className={cx(styles.matchChev, open && styles.matchChevOpen)} aria-hidden="true" />
            </button>
          ) : (
            <div className={styles.match} style={{ color: matchColor(score) }} aria-label={`${score}% match`}>
              {score}%
            </div>
          ))}
        <button
          type="button"
          className={cx(styles.add, alwaysShowAction && styles.always)}
          title={actionLabel}
          aria-label={`${actionLabel} “${track.title}”`}
          onClick={onAction}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {breakdown && open && (
        <div id={panelId} className={styles.breakdown}>
          {breakdown}
        </div>
      )}
    </li>
  );
}

function tempoDetail(p: PairScore, from: Track, to: Track): string {
  if (p.bpm.unknown) return 'Unknown tempo';
  const reading = p.bpm.via === 'double' ? ' (double time)' : p.bpm.via === 'half' ? ' (half time)' : '';
  return `${tempoFact(p.bpm)} · ${from.bpm} → ${to.bpm}${reading}`;
}

function genreDetail(p: PairScore, from: Track, to: Track): string {
  if (p.genre) return `Shared: ${from.genres.filter((g) => to.genres.includes(g)).slice(0, 2).join(', ')}`;
  return from.genres.length && to.genres.length ? 'Different genres' : 'No genre data';
}

function PartRow({ label, detail, color, points, max }: { label: string; detail: string; color: string; points: number; max: number }) {
  return (
    <div className={styles.bdRow}>
      <span className={styles.bdLabel}>{label}</span>
      <span className={styles.bdDetail} style={{ color }} title={detail}>
        {detail}
      </span>
      <span className={styles.bdPoints}>
        <span className={styles.meter} aria-hidden="true">
          <span style={{ width: `${(points / max) * 100}%`, background: color }} />
        </span>
        {points}/{max}
      </span>
    </div>
  );
}

function PairBreakdown({ pair, from, to }: { pair: PairScore; from: Track; to: Track }) {
  const pts = pairPoints(pair);
  return (
    <>
      <PartRow label="Key" detail={`${pair.key.label} · ${from.key ?? '–'} → ${to.key ?? '–'}`} color={OK_COLORS[pair.key.ok]} points={pts.key} max={WEIGHTS.key} />
      <PartRow
        label="Tempo"
        detail={tempoDetail(pair, from, to)}
        color={pair.bpm.unknown ? 'var(--mut)' : OK_COLORS[pair.bpm.ok]}
        points={pts.bpm}
        max={WEIGHTS.bpm}
      />
      <PartRow label="Genre" detail={genreDetail(pair, from, to)} color={pair.genre ? 'var(--r5)' : 'var(--mut)'} points={pts.genre} max={WEIGHTS.genre} />
    </>
  );
}

/** What makes up a match %: key, tempo and genre points against each neighbour. */
export function MatchBreakdown({ rec, targets }: { rec: Recommendation; targets: Track[] }) {
  const bridge = targets.length > 1;
  return (
    <>
      {targets.map((target, i) => (
        <div key={target.id} className={styles.bdGroup}>
          {bridge && (
            <div className={styles.bdHead}>
              <span title={target.title}>With “{target.title}”</span>
              <span style={{ color: matchColor(rec.pairs[i].score) }}>{rec.pairs[i].score}%</span>
            </div>
          )}
          <PairBreakdown pair={rec.pairs[i]} from={target} to={rec.track} />
        </div>
      ))}
      <div className={styles.bdTotal}>
        <span>{bridge ? 'Average of both' : 'Match'}</span>
        <span style={{ color: matchColor(rec.score) }}>{rec.score}%</span>
      </div>
      <div className={styles.bdNote}>
        Key up to {WEIGHTS.key} · tempo up to {WEIGHTS.bpm} · genre up to {WEIGHTS.genre}. Tempo must be within 6%.
      </div>
    </>
  );
}

export function RecommendationList({
  state,
  recs,
  targets,
  onFind,
  onInsert,
}: {
  state: CandidatesState;
  recs: Recommendation[];
  targets: Track[];
  onFind: () => void;
  onInsert: (track: Track) => void;
}) {
  if (state.status === 'idle' || state.status === 'loading') {
    const loading = state.status === 'loading';
    return (
      <div className={styles.find}>
        <button type="button" className={styles.findBtn} onClick={onFind} disabled={loading} aria-busy={loading}>
          {loading ? (
            <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
          ) : (
            <Sparkles size={16} aria-hidden="true" />
          )}
          {loading ? 'Finding matches…' : 'Find mix recommendations'}
        </button>
        <p className={styles.findHint}>Gemini suggests songs, then each one’s BPM and key are checked. Takes a few seconds.</p>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className={styles.find}>
        <div className={styles.none} role="status">
          Couldn’t load suggestions.
        </div>
        <button type="button" className={styles.findBtn} onClick={onFind}>
          Try again
        </button>
      </div>
    );
  }
  if (!recs.length) return <div className={styles.none}>No close matches.</div>;
  return (
    <ul className={styles.recs}>
      {recs.map((r) => (
        <TrackResult
          key={r.track.id}
          track={r.track}
          score={r.score}
          breakdown={<MatchBreakdown rec={r} targets={targets} />}
          actionLabel="Insert"
          onAction={() => onInsert(r.track)}
        />
      ))}
    </ul>
  );
}
