import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { cx } from '../../lib/cx';
import styles from './Sheet.module.css';

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Right-hand slide-over dialog. Closes on ✕, scrim click or Esc; traps focus while open
 * and hands it back to `returnFocus` on close. Put `data-autofocus` on an element to focus it first.
 */
export function Sheet({
  open,
  label,
  returnFocus,
  onClose,
  children,
}: {
  open: boolean;
  label: string;
  returnFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open || !panel.current) return;
    const trigger = returnFocus.current;
    const first = panel.current.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
    first.focus({ preventScroll: true });
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [open, returnFocus]);

  // If the focused control disappears (e.g. an inserted suggestion), keep focus inside the dialog.
  useEffect(() => {
    const el = panel.current;
    if (open && el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  });

  function trapTab(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab' || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.matches(':disabled') && el.offsetParent !== null,
    );
    if (!els.length) return e.preventDefault();
    const first = els[0];
    const last = els[els.length - 1];
    const current = document.activeElement;
    if (e.shiftKey && (current === first || current === panel.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={cx(styles.overlay, open && styles.open)}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        inert={!open}
        onKeyDown={trapTab}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
