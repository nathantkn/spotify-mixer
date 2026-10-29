import { useState } from 'react';
import type { Track } from '../../lib/types';
import styles from './Art.module.css';

/** Album art, or a gradient from the track's hue when there's no image (or it fails to load). */
export function Art({ track, size = 44, radius }: { track: Pick<Track, 'hue' | 'img'>; size?: number; radius?: number }) {
  const [broken, setBroken] = useState(false);
  const h = track.hue;
  return (
    <span
      className={styles.art}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `linear-gradient(140deg, hsl(${h} 55% 55%), hsl(${(h + 40) % 360} 45% 22%))`,
      }}
    >
      {track.img && !broken && <img src={track.img} alt="" loading="lazy" onError={() => setBroken(true)} />}
    </span>
  );
}
