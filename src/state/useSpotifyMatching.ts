import { useEffect, useRef, useState } from 'react';
import { chunk } from '../lib/http';
import { trackProvider } from '../lib/provider';
import { spotifyIdOf } from '../lib/spotifyId';
import type { Track } from '../lib/types';
import { usePlan } from './usePlan';

const BATCH = 20;

/** A track still needs Spotify if it has no Spotify id yet, or has one but is missing art or length. */
export function needsSpotify(t: Track): boolean {
  const sid = t.spotifyId ?? spotifyIdOf(t.id);
  return !sid || !t.img || !t.dur;
}

/**
 * Matches the plan's tracks to Spotify (id, album art, length) once per track, in batches, so art appears
 * progressively after an import. Only fills gaps. Returns progress while it runs, otherwise null.
 */
export function useSpotifyMatching(): { done: number; total: number } | null {
  const { plan, dispatch } = usePlan();
  const asked = useRef(new Set<string>());
  // Stop only when the mix view goes away. Each batch updates the plan, which re-runs the effect
  // below, so tying cancellation to that effect would stop after the first batch.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const totals = useRef({ done: 0, total: 0 });

  useEffect(() => {
    const todo = plan.tracks.filter((t) => needsSpotify(t) && !asked.current.has(t.id));
    if (!todo.length) return;
    for (const t of todo) asked.current.add(t.id);
    // Tracks added while a run is going (e.g. a second import batch) join the same count.
    totals.current.total += todo.length;
    setProgress({ ...totals.current });
    (async () => {
      let runDone = 0;
      try {
        for (const batch of chunk(todo, BATCH)) {
          const patches = await trackProvider.spotifyDetails(batch);
          if (!alive.current) return;
          if (Object.keys(patches).length) dispatch({ type: 'fillTrackData', patches });
          runDone += batch.length;
          totals.current.done += batch.length;
          setProgress({ ...totals.current });
        }
      } catch (err) {
        console.error(err); // e.g. Spotify not configured or rate-limited: leave the rest unmatched
        totals.current.done += todo.length - runDone; // count the skipped rest as done
      } finally {
        if (alive.current && totals.current.done >= totals.current.total) {
          totals.current = { done: 0, total: 0 };
          setProgress(null);
        }
      }
    })();
  }, [plan.tracks, dispatch]);

  return progress;
}
