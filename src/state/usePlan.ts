import { createContext, useContext, type Dispatch } from 'react';
import type { PlanState } from '../lib/types';
import type { PlanAction } from './planReducer';
import type { SaveStatus } from './usePlanAutosave';

export interface PlanContextValue {
  plan: PlanState;
  dispatch: Dispatch<PlanAction>;
  saveStatus: SaveStatus;
  saveNow: () => void;
}

/**
 * Lives in its own module with only type imports, so hot-reloading the reducer, autosave or provider
 * never recreates it. A recreated context orphans the provider on screen ("usePlan must be used inside").
 */
export const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>');
  return ctx;
}
