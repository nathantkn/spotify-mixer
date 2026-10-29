import { RATING_LABELS } from '../../lib/rating';
import type { Rating, Track } from '../../lib/types';
import { RatingBadge } from './RatingBadge';
import styles from './TrackTable.module.css';

export function TransitionLink({
  index,
  from,
  to,
  rating,
  onOpen,
}: {
  index: number;
  from: Track;
  to: Track;
  rating: Rating;
  onOpen: (fromId: string) => void;
}) {
  const state = rating ? `rated ${rating} of 5, ${RATING_LABELS[rating]}` : 'not rated';
  return (
    <button
      type="button"
      className={styles.link}
      onClick={() => onOpen(from.id)}
      aria-label={`Transition ${index + 1}: “${from.title}” to “${to.title}”, ${state}`}
    >
      <span className={styles.rail} />
      <RatingBadge rating={rating} className={styles.badge} />
    </button>
  );
}
