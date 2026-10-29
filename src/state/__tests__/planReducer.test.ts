import { describe, expect, it } from 'vitest';
import { avgMix } from '../../lib/plan';
import { samplePlan } from '../../lib/sample';
import type { Track } from '../../lib/types';
import { planReducer } from '../planReducer';

const ids = (s: { tracks: Track[] }) => s.tracks.map((t) => t.id);
const track = (id: string): Track => ({ id, title: id, artists: 'x', bpm: 100, key: '8A', dur: 200, genres: [], hue: 0 });

describe('planReducer', () => {
  it('loads and renames', () => {
    const s = planReducer(samplePlan(), { type: 'rename', title: 'New' });
    expect(s.title).toBe('New');
    const other = { ...samplePlan(), id: 'other' };
    expect(planReducer(s, { type: 'load', plan: other })).toBe(other);
  });

  it('adds to the end and inserts at an index', () => {
    let s = planReducer(samplePlan(), { type: 'add', track: track('n1') });
    expect(ids(s)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'n1']);
    s = planReducer(s, { type: 'insertAt', index: 1, track: track('n2') });
    expect(ids(s)).toEqual(['p1', 'n2', 'p2', 'p3', 'p4', 'p5', 'n1']);
  });

  it('never creates duplicate ids', () => {
    const s = planReducer(samplePlan(), { type: 'add', track: track('p1') });
    expect(ids(s)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p1~2']);
  });

  it('moves tracks; a no-op move returns the same state', () => {
    const start = samplePlan();
    expect(ids(planReducer(start, { type: 'move', from: 0, to: 2 }))).toEqual(['p2', 'p3', 'p1', 'p4', 'p5']);
    expect(ids(planReducer(start, { type: 'move', from: 4, to: 0 }))).toEqual(['p5', 'p1', 'p2', 'p3', 'p4']);
    expect(planReducer(start, { type: 'move', from: 2, to: 2 })).toBe(start);
    expect(planReducer(start, { type: 'move', from: 2, to: 9 })).toBe(start);
  });

  it('notes follow pairs: a split pair is unrated, restoring it restores the note', () => {
    const start = samplePlan();
    const split = planReducer(start, { type: 'move', from: 0, to: 2 }); // p2 p3 p1 …
    expect(split.notes['p1|p2']).toEqual(start.notes['p1|p2']); // kept in memory
    expect(avgMix(split)).toBe(5); // only p2|p3 is still a neighbouring pair
    const back = planReducer(split, { type: 'move', from: 2, to: 0 });
    expect(avgMix(back)).toBe(4);
  });

  it('sets ratings and notes, deleting empty notes', () => {
    let s = planReducer(samplePlan(), { type: 'setRating', from: 'p4', to: 'p5', rating: 2 });
    expect(s.notes['p4|p5']).toEqual({ rating: 2, text: '' });
    s = planReducer(s, { type: 'setNote', from: 'p4', to: 'p5', text: 'cut on the 1' });
    expect(s.notes['p4|p5']).toEqual({ rating: 2, text: 'cut on the 1' });
    s = planReducer(s, { type: 'setRating', from: 'p4', to: 'p5', rating: 0 });
    s = planReducer(s, { type: 'setNote', from: 'p4', to: 'p5', text: '' });
    expect(s.notes['p4|p5']).toBeUndefined();
  });

  it('fills missing track data without overwriting', () => {
    const start = planReducer(samplePlan(), { type: 'add', track: { ...track('n1'), bpm: null, key: null, dur: null } });
    const s = planReducer(start, {
      type: 'fillTrackData',
      patches: { n1: { bpm: 124, key: '5A', dur: 200 }, p1: { bpm: 90, key: '1B' }, gone: { bpm: 1 } },
    });
    expect(s.tracks.find((t) => t.id === 'n1')).toMatchObject({ bpm: 124, key: '5A', dur: 200 });
    expect(s.tracks.find((t) => t.id === 'p1')).toMatchObject({ bpm: 100, key: '6A' }); // already known
    expect(planReducer(s, { type: 'fillTrackData', patches: { p1: { bpm: 90 } } })).toBe(s); // no-op keeps identity
  });

  it('removes tracks (reducer only)', () => {
    expect(ids(planReducer(samplePlan(), { type: 'remove', id: 'p3' }))).toEqual(['p1', 'p2', 'p4', 'p5']);
  });
});
