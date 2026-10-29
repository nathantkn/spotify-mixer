import { keyHue } from '../../lib/camelot';
import { cx } from '../../lib/cx';
import type { CamelotKey } from '../../lib/types';
import styles from './KeyTag.module.css';

export function KeyTag({ value }: { value: CamelotKey | null }) {
  if (!value) {
    return (
      <span className={cx(styles.tk, styles.unk)} aria-label="Unknown key">
        –
      </span>
    );
  }
  const h = keyHue(value);
  return (
    <span className={styles.tk} style={{ color: `hsl(${h} 85% 72%)`, background: `hsl(${h} 70% 60% / .14)` }}>
      {value}
    </span>
  );
}
