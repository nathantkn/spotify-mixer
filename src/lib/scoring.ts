import { camelotParts } from './camelot';
import type { CamelotKey, Track } from './types';

/** 0 = clash/unknown, 1 = workable, 2 = good */
export type Ok = 0 | 1 | 2;

export interface KeyRelation { s: number; label: string; ok: Ok }
export interface BpmRelation {
  pct: number;
  s: number;
  ok: Ok;
  unknown: boolean;
  /** Which reading matched: straight, or the other track at double/half time. Absent when unknown. */
  via?: 'same' | 'double' | 'half';
}

export function keyRel(a: CamelotKey | null, b: CamelotKey | null): KeyRelation {
  if (!a || !b) return { s: 0, label: 'Unknown key', ok: 0 };
  const x = camelotParts(a);
  const y = camelotParts(b);
  const diff = Math.abs(x.n - y.n);
  const d = Math.min(diff, 12 - diff);
  const same = x.letter === y.letter;
  if (d === 0 && same) return { s: 1, label: 'Same key', ok: 2 };
  if (d === 0) return { s: 0.85, label: 'Relative', ok: 2 };
  if (d === 1 && same) return { s: 0.9, label: 'Adjacent', ok: 2 };
  if (d === 2 && same) return { s: 0.5, label: 'Energy shift', ok: 1 };
  if (d === 1) return { s: 0.35, label: 'Diagonal', ok: 1 };
  return { s: 0, label: 'Key clash', ok: 0 };
}

/** Half/double-time aware tempo distance, as a percentage of `a`. */
export function bpmRel(a: number | null, b: number | null): BpmRelation {
  if (!a || !b || a <= 0 || b <= 0) return { pct: Infinity, s: 0, ok: 0, unknown: true };
  const readings = [
    { via: 'same', v: b },
    { via: 'double', v: b * 2 },
    { via: 'half', v: b / 2 },
  ] as const;
  const best = readings
    .map((r) => ({ via: r.via, pct: (Math.abs(a - r.v) / a) * 100 }))
    .reduce((x, y) => (y.pct < x.pct ? y : x));
  const { pct, via } = best;
  return { pct, s: Math.max(0, 1 - pct / 6), ok: pct <= 3 ? 2 : pct <= 6 ? 1 : 0, unknown: false, via };
}

export function genreMatch(a: string[], b: string[]): 0 | 1 {
  return a.some((g) => b.includes(g)) ? 1 : 0;
}

export interface PairScore { key: KeyRelation; bpm: BpmRelation; genre: 0 | 1; score: number }

/** Points each part can contribute to a 0..100 match. */
export const WEIGHTS = { key: 50, bpm: 30, genre: 20 } as const;

/** Points per part, as shown in the match breakdown. */
export function pairPoints(p: PairScore): { key: number; bpm: number; genre: number } {
  return {
    key: Math.round(p.key.s * WEIGHTS.key),
    bpm: Math.round(p.bpm.s * WEIGHTS.bpm),
    genre: p.genre * WEIGHTS.genre,
  };
}

/** 0..100 */
export function pairScore(a: Track, b: Track): PairScore {
  const key = keyRel(a.key, b.key);
  const bpm = bpmRel(a.bpm, b.bpm);
  const genre = genreMatch(a.genres, b.genres);
  return { key, bpm, genre, score: Math.round(key.s * WEIGHTS.key + bpm.s * WEIGHTS.bpm + genre * WEIGHTS.genre) };
}

export function tempoFact(rel: BpmRelation): string {
  if (rel.unknown) return 'Unknown tempo';
  return rel.pct < 0.5 ? 'Locked' : `${rel.pct.toFixed(1)}% shift`;
}

export const OK_COLORS: Record<Ok, string> = { 0: 'var(--r1)', 1: 'var(--r3)', 2: 'var(--r5)' };
