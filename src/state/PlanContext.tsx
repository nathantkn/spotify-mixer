import { useMemo, useReducer, type ReactNode } from 'react';
import type { PlanState } from '../lib/types';
import { planReducer } from './planReducer';
import { PlanContext } from './usePlan';
import { usePlanAutosave } from './usePlanAutosave';

export function PlanProvider({ initial, saveOnOpen, children }: { initial: PlanState; saveOnOpen: boolean; children: ReactNode }) {
  const [plan, dispatch] = useReducer(planReducer, initial);
  const { status, saveNow } = usePlanAutosave(plan, saveOnOpen);
  const value = useMemo(() => ({ plan, dispatch, saveStatus: status, saveNow }), [plan, status, saveNow]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
