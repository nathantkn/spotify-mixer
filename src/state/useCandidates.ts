import { useState } from 'react';
import { trackProvider } from '../lib/provider';
import type { Track } from '../lib/types';

export type CandidatesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; tracks: Track[] }
  | { status: 'error' };

/**
 * Recommendation candidates for the seeds, fetched only when `find()` is called, because each fetch
 * costs a Gemini call and several FreqBlog lookups. Results already fetched this session show at once.
 */
export function useCandidates(seeds: Track[]): { state: CandidatesState; find: () => void } {
  const seedKey = seeds.map((t) => t.id).join('|');
  const [request, setRequest] = useState<{ key: string; state: CandidatesState }>({ key: '', state: { status: 'idle' } });

  function find() {
    const key = seedKey;
    setRequest({ key, state: { status: 'loading' } });
    trackProvider.candidates(seeds).then(
      (tracks) => setRequest((r) => (r.key === key ? { key, state: { status: 'ready', tracks } } : r)),
      (err) => {
        console.error(err);
        setRequest((r) => (r.key === key ? { key, state: { status: 'error' } } : r));
      },
    );
  }

  if (request.key === seedKey) return { state: request.state, find };
  const cached = seeds.length ? trackProvider.cachedCandidates(seeds) : null;
  return { state: cached ? { status: 'ready', tracks: cached } : { status: 'idle' }, find };
}
