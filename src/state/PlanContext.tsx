import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { PlanState } from '../lib/types';
import { planReducer, type PlanAction } from './planReducer';
import { usePlanAutosave, type SaveStatus } from './usePlanAutosave';

interface PlanContextValue {
  plan: PlanState;
  dispatch: Dispatch<PlanAction>;
  saveStatus: SaveStatus;
  saveNow: () => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ initial, saveOnOpen, children }: { initial: PlanState; saveOnOpen: boolean; children: ReactNode }) {
  const [plan, dispatch] = useReducer(planReducer, initial);
  const { status, saveNow } = usePlanAutosave(plan, saveOnOpen);
  const value = useMemo(() => ({ plan, dispatch, saveStatus: status, saveNow }), [plan, status, saveNow]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}
