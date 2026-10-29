import { Download } from 'lucide-react';
import type { SaveStatus } from '../../state/usePlanAutosave';
import styles from './TopBar.module.css';

export function TopBar({ status, onBack, onExport }: { status: SaveStatus; onBack: () => void; onExport: () => void }) {
  return (
    <div className={styles.topbar}>
      <button type="button" className={styles.back} onClick={onBack}>
        ‹ New plan
      </button>
      <span className={styles.saved} role="status">
        {status === 'saving' ? 'Saving…' : 'Saved'}
      </span>
      <button type="button" className={styles.ghost} onClick={onExport}>
        <Download size={14} strokeWidth={2} aria-hidden="true" />
        Export
      </button>
    </div>
  );
}
