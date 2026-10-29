import { describe, expect, it } from 'vitest';
import { toPlanFile } from '../../lib/planFile';
import { emptyPlan } from '../../lib/plan';
import { samplePlan } from '../../lib/sample';
import type { PlanFileV1 } from '../../lib/types';
import { createPlanStorage, MAX_PLANS, STORAGE_KEY } from '../planStorage';

class MemoryStorage implements Storage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(k: string) { return this.data.get(k) ?? null; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  removeItem(k: string) { this.data.delete(k); }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

const file = (id: string, updated: number, over: Partial<PlanFileV1> = {}): PlanFileV1 => ({
  ...toPlanFile({ ...samplePlan(), id }, updated),
  ...over,
});

describe('planStorage', () => {
  it('puts, lists newest first, gets and removes', () => {
    const ls = new MemoryStorage();
    const store = createPlanStorage(() => ls);
    store.put(file('a', 1));
    store.put(file('b', 2));
    store.put(file('a', 3, { title: 'A2' }));
    expect(store.list().map((p) => p.id)).toEqual(['a', 'b']);
    expect(store.get('a')?.title).toBe('A2');
    expect(JSON.parse(ls.getItem(STORAGE_KEY)!)).toHaveLength(2);
    store.remove('a');
    expect(store.list().map((p) => p.id)).toEqual(['b']);
  });

  it(`caps at ${MAX_PLANS}`, () => {
    const store = createPlanStorage(() => new MemoryStorage());
    for (let i = 0; i < 35; i++) store.put(file(`p${i}`, i));
    const list = store.list();
    expect(list).toHaveLength(MAX_PLANS);
    expect(list[0].id).toBe('p34');
  });

  it('removes an empty "Untitled mix" instead of storing it', () => {
    const store = createPlanStorage(() => new MemoryStorage());
    const draft = emptyPlan();
    store.put(toPlanFile(draft));
    expect(store.list()).toEqual([]);
    store.put(toPlanFile({ ...draft, title: 'Named' }));
    expect(store.list()).toHaveLength(1);
    store.put(toPlanFile(draft)); // emptied back to the default
    expect(store.list()).toEqual([]);
  });

  it('falls back to memory when storage is unavailable', () => {
    const store = createPlanStorage(() => undefined);
    store.put(file('a', 1));
    expect(store.list().map((p) => p.id)).toEqual(['a']);
  });

  it('falls back to memory when storage access throws', () => {
    const store = createPlanStorage(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    store.put(file('a', 1));
    store.remove('a');
    store.put(file('b', 2));
    expect(store.list().map((p) => p.id)).toEqual(['b']);
  });

  it('keeps working in memory after a failed write (e.g. quota)', () => {
    const ls = new MemoryStorage();
    const store = createPlanStorage(() => ls);
    store.put(file('a', 1));
    ls.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    store.put(file('b', 2));
    expect(store.list().map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('ignores corrupt stored data', () => {
    const ls = new MemoryStorage();
    ls.setItem(STORAGE_KEY, '{not json');
    expect(createPlanStorage(() => ls).list()).toEqual([]);
    ls.setItem(STORAGE_KEY, JSON.stringify([{ id: 'x' }, file('ok', 1), null]));
    expect(createPlanStorage(() => ls).list().map((p) => p.id)).toEqual(['ok']);
  });
});
