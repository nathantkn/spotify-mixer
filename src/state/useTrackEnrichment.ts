import { useEffect, useRef } from 'react';
import { trackProvider } from '../lib/provider';
import { usePlan } from './usePlan';

/**
 * Asks the provider for BPM, key and genres for tracks that are missing them,
 * once per track, and fills the gaps in.
 */
export function useTrackEnrichment(): void {
  const { plan, dispatch } = usePlan();
  const asked = useRef(new Set<string>());

  useEffect(() => {
    const missing = plan.tracks.filter(
      (t) => (t.bpm == null || t.key == null || !t.genres.length) && !asked.current.has(t.id),
    );
    if (!missing.length) return;
    for (const t of missing) asked.current.add(t.id);
    trackProvider.features(missing).then(
      (patches) => Object.keys(patches).length && dispatch({ type: 'fillTrackData', patches }),
      (err) => console.error(err),
    );
  }, [plan.tracks, dispatch]);
}
