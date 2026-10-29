import { useCallback, useEffect, useRef, useState } from 'react';
import { toPlanFile } from '../lib/planFile';
import type { PlanState } from '../lib/types';
import { planStorage, type PlanStorage } from './planStorage';

export type SaveStatus = 'saving' | 'saved';

const DEBOUNCE_MS = 400;

/**
 * Saves 400ms after any change, and immediately via `saveNow` (back button, export) or on page unload.
 * With `saveOnOpen` false the opening state counts as already saved, so reopening a plan
 * doesn't bump its "edited" time.
 */
export function usePlanAutosave(plan: PlanState, saveOnOpen: boolean, storage: PlanStorage = planStorage) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const latest = useRef(plan);
  const persisted = useRef<PlanState | null>(saveOnOpen ? null : plan);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const saveNow = useCallback(() => {
    clearTimeout(timer.current);
    if (latest.current === persisted.current) return;
    storage.put(toPlanFile(latest.current));
    persisted.current = latest.current;
    setStatus('saved');
  }, [storage]);

  useEffect(() => {
    latest.current = plan;
    if (plan === persisted.current) return;
    setStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, DEBOUNCE_MS);
  }, [plan, saveNow]);

  useEffect(() => {
    window.addEventListener('beforeunload', saveNow);
    window.addEventListener('pagehide', saveNow);
    return () => {
      window.removeEventListener('beforeunload', saveNow);
      window.removeEventListener('pagehide', saveNow);
      saveNow(); // flush anything pending on unmount
    };
  }, [saveNow]);

  return { status, saveNow };
}
