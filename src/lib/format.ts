/** Seconds → m:ss, or "–" when unknown. */
export function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '–';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "m:ss" or plain minutes → seconds; null when it can't be read. */
export function parseLength(value: string): number | null {
  const m = value.trim().match(/^(\d+)(?::(\d{1,2}))?$/);
  if (!m) return null;
  const secs = Number(m[1]) * 60 + Number(m[2] ?? 0);
  return secs > 0 ? secs : null;
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const s = (now - timestamp) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 7 ? `${d}d ago` : new Date(timestamp).toLocaleDateString();
}

/** Stable 0..359 hash of a string, for fallback album art. */
export function hueOf(s: string): number {
  return [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
