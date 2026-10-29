import type { Track } from '../../lib/types';
import shared from '../../styles/shared.module.css';
import { Art } from '../mix/Art';
import styles from './sheetBody.module.css';

export function TrackMini({ track }: { track: Track }) {
  return (
    <div className={styles.mini}>
      <Art track={track} size={36} />
      <div className={shared.info}>
        <div className={shared.title} title={track.title}>
          {track.title}
        </div>
        <div className={shared.artist} title={track.artists}>
          {track.artists}
        </div>
      </div>
    </div>
  );
}
