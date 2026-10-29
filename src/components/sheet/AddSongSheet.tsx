import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ALL_KEYS } from '../../lib/camelot';
import { hueOf, newId, parseLength } from '../../lib/format';
import { trackProvider } from '../../lib/provider';
import { inPlanMatcher } from '../../lib/recommend';
import type { CamelotKey, Track } from '../../lib/types';
import { usePlan } from '../../state/usePlan';
import shared from '../../styles/shared.module.css';
import { TrackResult } from './RecommendationList';
import styles from './sheetBody.module.css';

const MAX_RESULTS = 6;
const DEFAULT_LENGTH = 210; // 3:30
const SEARCH_DEBOUNCE_MS = 250;

type SearchState = { status: 'loading' | 'done' | 'error'; tracks: Track[] };

export function AddSongSheet() {
  const { plan, dispatch } = usePlan();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'loading', tracks: [] });
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [bpm, setBpm] = useState('');
  const [key, setKey] = useState<CamelotKey>('1A');
  const [length, setLength] = useState('');
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setSearch((s) => ({ ...s, status: 'loading' }));
    // Debounced, since every keystroke would otherwise be a network request.
    const timer = setTimeout(
      () =>
        trackProvider.search(query, ctrl.signal).then(
          (tracks) => !ctrl.signal.aborted && setSearch({ status: 'done', tracks }),
          (err) => {
            if (ctrl.signal.aborted) return;
            console.error(err);
            setSearch({ status: 'error', tracks: [] });
          },
        ),
      query.trim() ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const inPlan = inPlanMatcher(plan.tracks);
  const results = search.tracks.filter((t) => !inPlan(t)).slice(0, MAX_RESULTS);
  const typed = query.trim() !== '';
  const bpmValue = Math.round(Number(bpm));
  const canAdd = title.trim() !== '' && bpmValue > 0;

  function add(track: Track) {
    dispatch({ type: 'add', track });
    setToast(`Added “${track.title}”`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2000);
  }

  function addManual(e: FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    const t = title.trim();
    add({
      id: newId('m'),
      title: t,
      artists: artist.trim() || 'Unknown artist',
      bpm: bpmValue,
      key,
      dur: parseLength(length) ?? DEFAULT_LENGTH,
      genres: [],
      img: null,
      hue: hueOf(t),
    });
    setTitle('');
    setArtist('');
    setBpm('');
    setLength('');
    titleInput.current?.focus();
  }

  return (
    <>
      <div className={shared.eyebrow}>Add to mix</div>
      <h2 className={styles.h2}>Add a song</h2>

      <input
        data-autofocus
        className={shared.field}
        placeholder="Search by title or artist"
        aria-label="Search by title or artist"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.results} aria-busy={search.status === 'loading'}>
        {search.status === 'error' ? (
          <div className={styles.none}>Search isn’t available right now. Add it manually below.</div>
        ) : results.length ? (
          <ul className={styles.recs} aria-label="Search results">
            {results.map((t) => (
              <TrackResult key={t.id} track={t} actionLabel="Add" alwaysShowAction onAction={() => add(t)} />
            ))}
          </ul>
        ) : typed && search.status === 'loading' ? (
          <div className={styles.none}>Searching…</div>
        ) : typed && search.status === 'done' ? (
          <div className={styles.none}>No matches. Add it manually below.</div>
        ) : null}
      </div>

      <div className={shared.divider}>or add manually</div>

      <form onSubmit={addManual} noValidate>
        <input
          ref={titleInput}
          className={shared.field}
          placeholder="Title"
          aria-label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={shared.field}
          style={{ marginTop: 8 }}
          placeholder="Artist"
          aria-label="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <div className={styles.grid3}>
          <label>
            <span className={styles.lbl}>BPM</span>
            <input
              className={shared.field}
              type="number"
              inputMode="decimal"
              min={40}
              max={220}
              placeholder="100"
              required
              value={bpm}
              onChange={(e) => setBpm(e.target.value)}
            />
          </label>
          <label>
            <span className={styles.lbl}>Key</span>
            <select className={shared.field} value={key} onChange={(e) => setKey(e.target.value as CamelotKey)}>
              {ALL_KEYS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={styles.lbl}>Length</span>
            <input className={shared.field} placeholder="3:30" value={length} onChange={(e) => setLength(e.target.value)} />
          </label>
        </div>
        <button type="submit" className={styles.primary} disabled={!canAdd}>
          Add to end of mix
        </button>
      </form>
      <div className={styles.toast} role="status">
        {toast}
      </div>
    </>
  );
}
