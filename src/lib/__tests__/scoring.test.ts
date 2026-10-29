import { describe, expect, it } from 'vitest';
import { bpmRel, keyRel, pairPoints, pairScore, tempoFact } from '../scoring';
import type { Track } from '../types';

const t = (over: Partial<Track>): Track => ({
  id: 'x', title: 'x', artists: 'x', bpm: 100, key: '8A', dur: 200, genres: [], hue: 0, ...over,
});

describe('keyRel', () => {
  it.each([
    ['8A', '8A', 1, 'Same key', 2],
    ['8A', '8B', 0.85, 'Relative', 2],
    ['8A', '9A', 0.9, 'Adjacent', 2],
    ['8A', '7A', 0.9, 'Adjacent', 2],
    ['8A', '10A', 0.5, 'Energy shift', 1],
    ['8A', '9B', 0.35, 'Diagonal', 1],
    ['8A', '10B', 0, 'Key clash', 0],
    ['8A', '2A', 0, 'Key clash', 0],
    ['12A', '1A', 0.9, 'Adjacent', 2],
    ['1A', '12A', 0.9, 'Adjacent', 2],
    ['11B', '1B', 0.5, 'Energy shift', 1],
    ['12A', '1B', 0.35, 'Diagonal', 1],
  ] as const)('%s → %s is %s (%s)', (a, b, s, label, ok) => {
    expect(keyRel(a, b)).toEqual({ s, label, ok });
  });

  it('handles unknown keys', () => {
    expect(keyRel(null, '8A')).toEqual({ s: 0, label: 'Unknown key', ok: 0 });
    expect(keyRel('8A', null)).toEqual({ s: 0, label: 'Unknown key', ok: 0 });
  });
});

describe('bpmRel', () => {
  it('locks identical tempos', () => {
    expect(bpmRel(100, 100)).toMatchObject({ pct: 0, s: 1, ok: 2, unknown: false });
  });
  it('is half-time and double-time aware', () => {
    expect(bpmRel(100, 50).pct).toBe(0);
    expect(bpmRel(100, 200).pct).toBe(0);
    expect(bpmRel(160, 80).ok).toBe(2);
    expect(bpmRel(84, 168).pct).toBe(0);
    expect(bpmRel(100, 100).via).toBe('same');
    expect(bpmRel(100, 50).via).toBe('double');
    expect(bpmRel(100, 200).via).toBe('half');
  });
  it('grades shifts', () => {
    expect(bpmRel(100, 103)).toMatchObject({ ok: 2 });
    expect(bpmRel(100, 105)).toMatchObject({ ok: 1 });
    expect(bpmRel(100, 107)).toMatchObject({ ok: 0, s: 0 });
    expect(bpmRel(100, 103).s).toBeCloseTo(0.5);
  });
  it('handles a null BPM', () => {
    expect(bpmRel(null, 100)).toEqual({ pct: Infinity, s: 0, ok: 0, unknown: true });
    expect(bpmRel(100, null).unknown).toBe(true);
  });
});

describe('pairScore', () => {
  it('weights key .5, bpm .3, genre .2', () => {
    expect(pairScore(t({ genres: ['r&b'] }), t({ genres: ['r&b'] })).score).toBe(100);
    expect(pairScore(t({}), t({})).score).toBe(80);
    expect(pairScore(t({ key: null }), t({})).score).toBe(30);
    expect(pairScore(t({ bpm: null, key: null }), t({})).score).toBe(0);
  });
  it('breaks the score into points that add up', () => {
    const p = pairScore(t({ key: '8A', bpm: 100, genres: ['r&b'] }), t({ key: '9A', bpm: 101, genres: ['r&b'] }));
    const pts = pairPoints(p);
    expect(pts).toEqual({ key: 45, bpm: 25, genre: 20 });
    expect(pts.key + pts.bpm + pts.genre).toBe(p.score);
  });
});

describe('tempoFact', () => {
  it('describes the tempo relation', () => {
    expect(tempoFact(bpmRel(100, 100))).toBe('Locked');
    expect(tempoFact(bpmRel(100, 102))).toBe('2.0% shift');
    expect(tempoFact(bpmRel(null, 100))).toBe('Unknown tempo');
  });
});
