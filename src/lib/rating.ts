import type { Rating } from './types';

export const RATINGS = [1, 2, 3, 4, 5] as const;

export const RATING_LABELS: Record<Rating, string> = {
  0: '',
  1: 'Trainwreck',
  2: 'Rough',
  3: 'Works',
  4: 'Smooth',
  5: 'Seamless',
};

export const ratingColor = (r: Rating) => (r ? `var(--r${r})` : 'transparent');

export function clampRating(value: unknown): Rating {
  const n = Math.round(Number(value));
  return (Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0) as Rating;
}
