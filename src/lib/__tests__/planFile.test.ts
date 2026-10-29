import { describe, expect, it } from 'vitest';
import { fromPlanFile, parsePlanJson, planFileName, serializePlan, toPlanFile } from '../planFile';
import { importKind, importText } from '../importFile';
import { samplePlan } from '../sample';
import type { PlanState } from '../types';

describe('plan file round trip', () => {
  it('export → import equals the original', () => {
    const plan = samplePlan();
    const restored = parsePlanJson(serializePlan(toPlanFile(plan, 123)));
    expect(restored).toEqual(plan);
  });

  it('round-trips the Spotify id and ignores invalid ones', () => {
    const plan = samplePlan();
    plan.tracks[0] = { ...plan.tracks[0], spotifyId: '7eqoqGkKwgOaWNNHx90uEZ', img: 'https://i.scdn.co/x' };
    const file = toPlanFile(plan, 1);
    expect(file.tracks[0].spotifyId).toBe('7eqoqGkKwgOaWNNHx90uEZ');
    expect('spotifyId' in file.tracks[1]).toBe(false);
    expect(parsePlanJson(serializePlan(file))).toEqual(plan);
    expect(fromPlanFile({ tracks: [{ title: 'x', spotifyId: 'nope' }] }).tracks[0].spotifyId).toBeUndefined();
  });

  it('drops orphaned and empty notes on export', () => {
    const plan: PlanState = {
      ...samplePlan(),
      notes: {
        ...samplePlan().notes,
        'p1|gone': { rating: 4, text: 'orphan' },
        'p4|p5': { rating: 0, text: '' },
        'p5|p1': { rating: 0, text: 'not neighbours but both present' },
      },
    };
    const file = toPlanFile(plan, 1);
    expect(file.transitions.map((x) => `${x.from}|${x.to}`)).toEqual(['p1|p2', 'p2|p3', 'p3|p4', 'p5|p1']);
    const restored = parsePlanJson(serializePlan(file));
    expect(restored.notes['p1|gone' as const]).toBeUndefined();
    expect(restored.notes['p5|p1' as const]).toEqual({ rating: 0, text: 'not neighbours but both present' });
  });

  it('writes the v1 shape', () => {
    const file = toPlanFile({ ...samplePlan(), title: '  ' }, 42);
    expect(file).toMatchObject({ version: 1, id: 'sample', title: 'Untitled mix', updated: 42 });
    expect(file.tracks[0]).toEqual({
      id: 'p1', title: 'Parking Lot', artists: 'Mustard, Travis Scott', bpm: 100, key: '6A', dur: 173,
      genres: ['hip hop', 'trap'], img: null, hue: 30,
    });
    expect(serializePlan(file)).toContain('\n  "version": 1');
  });
});

describe('fromPlanFile (forgiving import)', () => {
  it('cleans bad values', () => {
    const plan = fromPlanFile({
      title: 'X',
      tracks: [
        { title: 'Ok', bpm: 99.6, key: '8a', dur: 200 },
        { title: '' },
        { artists: 'no title' },
        { id: 'z', title: 'Bad', bpm: -3, key: 'H#', dur: 0 },
      ],
      transitions: [{ from: 'z', to: 'q', rating: 9, note: 'n' }, { from: 'q', to: 'z', rating: -2 }, { to: 'z' }],
    });
    expect(plan.id).toMatch(/^plan_/);
    expect(plan.tracks).toHaveLength(2);
    expect(plan.tracks[0]).toMatchObject({ bpm: 100, key: '8A', dur: 200, artists: 'Unknown artist', genres: [], img: null });
    expect(plan.tracks[0].id).toBeTruthy();
    expect(plan.tracks[1]).toMatchObject({ id: 'z', bpm: null, key: null, dur: null });
    expect(plan.notes).toEqual({ 'z|q': { rating: 5, text: 'n' }, 'q|z': { rating: 0, text: '' } });
  });

  it('rejects files without a tracks array', () => {
    expect(() => fromPlanFile({ title: 'x' })).toThrow('This doesn’t look like a mix plan file.');
    expect(() => fromPlanFile(null)).toThrow('This doesn’t look like a mix plan file.');
    expect(() => parsePlanJson('{nope')).toThrow('That JSON file couldn’t be read.');
  });
});

describe('import file', () => {
  it('rejects other file types', () => {
    expect(() => importKind({ name: 'mix.txt', type: 'text/plain' })).toThrow(
      'Use a playlist .csv or a saved .mixplan.json file.',
    );
    expect(importKind({ name: 'a.mixplan.json', type: '' })).toBe('json');
    expect(importKind({ name: 'a.CSV', type: '' })).toBe('csv');
  });
  it('names CSV plans after the file', () => {
    const r = importText({ name: 'Late_Night.csv', type: 'text/csv' }, 'Track Name\nA\n');
    expect(r.kind).toBe('csv');
    expect(r.plan.title).toBe('Late Night');
  });
});

describe('planFileName', () => {
  it('slugs the title', () => {
    expect(planFileName('Late Night 100')).toBe('Late-Night-100.mixplan.json');
    expect(planFileName('???')).toBe('mix.mixplan.json');
  });
});
