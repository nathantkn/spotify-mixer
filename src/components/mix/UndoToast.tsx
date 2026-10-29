import { useEffect, useRef } from 'react';
import styles from './MixView.module.css';

const SHOW_MS = 6000;

/** "Removed “X” · Undo" for a few seconds. Takes focus so keyboard users can undo right away. */
export function UndoToast({ message, onUndo, onDone }: { message: string; onUndo: () => void; onDone: (hadFocus: boolean) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const undo = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    undo.current?.focus({ preventScroll: true });
    const timer = setTimeout(() => doneRef.current(!!root.current?.contains(document.activeElement)), SHOW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={root} className={styles.toast} role="status">
      <span className={styles.toastText} title={message}>
        {message}
      </span>
      <button ref={undo} type="button" className={styles.toastUndo} onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
