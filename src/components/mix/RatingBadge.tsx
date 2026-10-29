import { cx } from '../../lib/cx';
import { ratingColor } from '../../lib/rating';
import type { Rating } from '../../lib/types';
import styles from './RatingBadge.module.css';

export function RatingBadge({ rating, className }: { rating: Rating; className?: string }) {
  if (!rating) return <span className={cx(styles.badge, styles.empty, className)}>+ Rate mix</span>;
  return (
    <span className={cx(styles.badge, className)}>
      <span className={styles.dot} style={{ background: ratingColor(rating) }} />
      {rating}/5
    </span>
  );
}
