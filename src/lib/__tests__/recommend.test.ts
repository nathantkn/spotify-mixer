import { describe, expect, it } from 'vitest';
import { matchColor, recommend } from '../recommend';
import type { Track } from '../types';

let n = 0;
const t = (over: Partial<Track>): Track => ({
  id: `id${n++}`, title: `Song ${n}`, artists: 'Artist', bpm: 100, key: '8A', dur: 200, genres: ['hip hop'], hue: 0, ...over,
});

describe('recommend', () => {
  const a = t({ id: 'a', title: 'A', key: '8A', bpm: 100 });
  const b = t({ id: 'b', title: 'B', key: '9A', bpm: 100 });

  it('excludes plan tracks by id and by normalised title + artist', () => {
    const pool = [
      t({ id: 'a', title: 'Different' }),
      t({ id: 'zz', title: '  a!', artists: 'ARTIST' }),
      t({ id: 'keep', title: 'Keep' }),
    ];
    expect(recommend([a], pool, [a, b]).map((r) => r.track.id)).toEqual(['keep']);
  });

  it('keeps only candidates within 6% BPM of every target', () => {
    const slowB = { ...b, bpm: 94 };
    const pool = [t({ id: 'c97', bpm: 97 }), t({ id: 'c100', bpm: 100 }), t({ id: 'c50', bpm: 50 })];
    // 100 is 6.4% from 94, so only 97 fits both.
    expect(recommend([a, slowB], pool, [a, slowB]).map((r) => r.track.id)).toEqual(['c97']);
    // Half-time 50 fits a single 100 target.
    expect(recommend([a], pool, [a]).map((r) => r.track.id)).toContain('c50');
  });

  it('drops candidates with unknown BPM', () => {
    expect(recommend([a], [t({ bpm: null })], [a])).toEqual([]);
  });

  it('averages scores across targets and returns the top 5, best first', () => {
    const pool = ['8A', '9A', '8B', '10A', '9B', '3A', '7A'].map((key) => t({ id: key, key: key as Track['key'] }));
    const recs = recommend([a, b], pool, [a, b]);
    expect(recs).toHaveLength(5);
    expect(recs.map((r) => r.score)).toEqual([...recs.map((r) => r.score)].sort((x, y) => y - x));
    // 8A vs A: 100, vs B (Adjacent): 95 → 98 (rounded average of 100 and 95 = 97.5)
    expect(recs[0]).toMatchObject({ score: 98 });
  });

  it('colours match %', () => {
    expect(matchColor(75)).toBe('var(--r5)');
    expect(matchColor(50)).toBe('var(--r3)');
    expect(matchColor(49)).toBe('var(--mut)');
  });
});
