import { pairScore, type PairScore } from './scoring';
import type { Track } from './types';

export interface Recommendation {
  track: Track;
  /** Average of `pairs` scores, 0..100. */
  score: number;
  /** The candidate scored against each target, in target order. */
  pairs: PairScore[];
}

const MAX_BPM_SHIFT = 6;

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const identity = (t: Track) => `${norm(t.title)}|${norm(t.artists)}`;

/** Matches by id, and by normalised title + artist since pool and CSV ids may differ. */
export function inPlanMatcher(plan: Track[]): (t: Track) => boolean {
  const ids = new Set(plan.map((t) => t.id));
  const names = new Set(plan.map(identity));
  return (t) => ids.has(t.id) || names.has(identity(t));
}

/**
 * Targets are [A, B] for a transition and [A] for a single track.
 * Keeps candidates within 6% BPM of every target, ranked by average pair score.
 */
export function recommend(targets: Track[], pool: Track[], plan: Track[], limit = 5): Recommendation[] {
  if (!targets.length) return [];
  const inPlan = inPlanMatcher(plan);
  return pool
    .filter((c) => !inPlan(c))
    .map((c) => {
      const pairs = targets.map((t) => pairScore(t, c));
      return {
        track: c,
        score: Math.round(pairs.reduce((sum, p) => sum + p.score, 0) / pairs.length),
        pairs,
      };
    })
    .filter((r) => r.pairs.every((p) => p.bpm.pct <= MAX_BPM_SHIFT))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function matchColor(score: number): string {
  return score >= 75 ? 'var(--r5)' : score >= 50 ? 'var(--r3)' : 'var(--mut)';
}
