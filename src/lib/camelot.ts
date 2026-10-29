import type { CamelotKey } from './types';

const CAMELOT_RE = /^(1[0-2]|[1-9])[AB]$/i;

/** Indexed by Spotify pitch class (0 = C … 11 = B). */
export const CAMELOT_MINOR: CamelotKey[] = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];
export const CAMELOT_MAJOR: CamelotKey[] = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];

/** 1A…12A, then 1B…12B. */
export const ALL_KEYS = (['A', 'B'] as const).flatMap((m) =>
  Array.from({ length: 12 }, (_, i) => `${i + 1}${m}` as CamelotKey),
);

/** Returns the value as an uppercased Camelot key, or null if it isn't one. */
export function parseCamelot(value: unknown): CamelotKey | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return CAMELOT_RE.test(v) ? (v.toUpperCase() as CamelotKey) : null;
}

/**
 * Spotify Key (pitch class) + Mode (1 = major, 0 = minor) → Camelot.
 * A Key that is already a Camelot key is used directly.
 */
export function toCamelot(key: unknown, mode?: unknown): CamelotKey | null {
  const direct = parseCamelot(key);
  if (direct) return direct;
  if (key == null || String(key).trim() === '') return null;
  const pc = Number(key);
  if (!Number.isInteger(pc) || pc < 0 || pc > 11) return null;
  return (Number(mode) === 1 ? CAMELOT_MAJOR : CAMELOT_MINOR)[pc];
}

export function camelotParts(key: CamelotKey): { n: number; letter: 'A' | 'B' } {
  return { n: Number(key.slice(0, -1)), letter: key.slice(-1) as 'A' | 'B' };
}

/** Tag hue: (number − 1) × 30 */
export function keyHue(key: CamelotKey): number {
  return (camelotParts(key).n - 1) * 30;
}

/** Open Key (Traktor), e.g. "2m" / "11d" → Camelot. 1d = C major = 8B, 1m = A minor = 8A. */
export function fromOpenKey(value: unknown): CamelotKey | null {
  const m = typeof value === 'string' ? value.trim().match(/^(1[0-2]|[1-9])([dm])$/i) : null;
  if (!m) return null;
  const n = ((Number(m[1]) + 6) % 12) + 1;
  return `${n}${m[2].toLowerCase() === 'd' ? 'B' : 'A'}` as CamelotKey;
}

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A key name such as "Em", "F♯m", "Bb", "C# minor", "Db major" → Camelot. */
export function fromKeyName(value: unknown): CamelotKey | null {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^([A-Ga-g])\s*([#♯b♭]?)\s*(m(?:in(?:or)?)?|maj(?:or)?)?$/);
  if (!m) return null;
  let pc = NOTE_PC[m[1].toUpperCase()];
  if (m[2] === '#' || m[2] === '♯') pc += 1;
  if (m[2] === 'b' || m[2] === '♭') pc -= 1;
  const minor = !!m[3] && m[3].toLowerCase().startsWith('m') && !m[3].toLowerCase().startsWith('maj');
  return toCamelot((pc + 12) % 12, minor ? 0 : 1);
}
