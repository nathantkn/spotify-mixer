import { useEffect, useState } from 'react';
import { trackProvider } from '../lib/provider';
import type { Track } from '../lib/types';

export type CandidatesState = { status: 'loading' } | { status: 'ready'; tracks: Track[] } | { status: 'error' };

/** Recommendation candidates for the seeds, from the active provider. Refetches when the seeds change. */
export function useCandidates(seeds: Track[]): CandidatesState {
  const seedKey = seeds.map((t) => t.id).join('|');
  const [state, setState] = useState<{ key: string; value: CandidatesState }>({ key: '', value: { status: 'loading' } });

  useEffect(() => {
    const ctrl = new AbortController();
    trackProvider.candidates(seeds, ctrl.signal).then(
      (tracks) => !ctrl.signal.aborted && setState({ key: seedKey, value: { status: 'ready', tracks } }),
      (err) => {
        if (ctrl.signal.aborted) return;
        console.error(err);
        setState({ key: seedKey, value: { status: 'error' } });
      },
    );
    return () => ctrl.abort();
    // `seeds` is captured by identity of `seedKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  return state.key === seedKey ? state.value : { status: 'loading' };
}
