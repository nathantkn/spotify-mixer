import { DEFAULT_TITLE } from '../lib/plan';
import type { PlanFileV1 } from '../lib/types';

export const STORAGE_KEY = 'mixplanner.plans.v1';
export const MAX_PLANS = 30;

export interface PlanStorage {
  /** Newest first. */
  list(): PlanFileV1[];
  get(id: string): PlanFileV1 | undefined;
  /** Moves the plan to the front. An empty "Untitled mix" is removed instead of stored. */
  put(plan: PlanFileV1): void;
  remove(id: string): void;
}

const isStoredPlan = (p: unknown): p is PlanFileV1 =>
  typeof p === 'object' && p !== null && typeof (p as PlanFileV1).id === 'string' && Array.isArray((p as PlanFileV1).tracks);

export const isEmptyDraft = (p: PlanFileV1) => p.tracks.length === 0 && p.title === DEFAULT_TITLE;

/**
 * localStorage-backed, falling back to memory whenever storage is missing, blocked or full.
 * `getStorage` may itself throw (e.g. a SecurityError in some private modes).
 */
export function createPlanStorage(getStorage: () => Storage | undefined = () => globalThis.localStorage): PlanStorage {
  let memory: PlanFileV1[] = [];
  let useMemory = false;

  const read = (): PlanFileV1[] => {
    if (useMemory) return memory;
    try {
      const raw = getStorage()?.getItem(STORAGE_KEY);
      if (raw == null) return memory;
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(isStoredPlan) : memory;
    } catch {
      return memory;
    }
  };

  const write = (list: PlanFileV1[]) => {
    memory = list;
    try {
      const storage = getStorage();
      if (!storage) throw new Error('no storage');
      storage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      useMemory = true; // don't read back a stale copy we failed to update
    }
  };

  return {
    list: () => [...read()].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0)),
    get: (id) => read().find((p) => p.id === id),
    put(plan) {
      const rest = read().filter((p) => p.id !== plan.id);
      write((isEmptyDraft(plan) ? rest : [plan, ...rest]).slice(0, MAX_PLANS));
    },
    remove(id) {
      write(read().filter((p) => p.id !== id));
    },
  };
}

export const planStorage = createPlanStorage();
