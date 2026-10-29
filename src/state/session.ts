import type { PlanState } from '../lib/types';

/** One opening of the mix view. */
export interface PlanSession {
  key: string;
  plan: PlanState;
  /** New and imported plans are saved straight away; plans reopened from storage aren't. */
  saveOnOpen: boolean;
  focusTitle?: boolean;
  fromCsv?: boolean;
}

let counter = 0;

export function createSession(plan: PlanState, opts: Omit<PlanSession, 'key' | 'plan'>): PlanSession {
  return { key: `${plan.id}#${++counter}`, plan, ...opts };
}
