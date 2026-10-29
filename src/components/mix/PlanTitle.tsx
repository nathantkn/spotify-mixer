import { useEffect, useRef } from 'react';
import { DEFAULT_TITLE } from '../../lib/plan';
import { usePlan } from '../../state/PlanContext';
import styles from './PlanTitle.module.css';

export function PlanTitle({ autoFocus }: { autoFocus?: boolean }) {
  const { plan, dispatch } = usePlan();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    input.current?.focus();
    input.current?.select();
  }, [autoFocus]);

  return (
    <h1 className={styles.h1}>
      <input
        ref={input}
        className={styles.input}
        value={plan.title}
        title={plan.title}
        aria-label="Mix title"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => dispatch({ type: 'rename', title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
        }}
        onBlur={(e) => {
          if (!e.target.value.trim()) dispatch({ type: 'rename', title: DEFAULT_TITLE });
        }}
      />
    </h1>
  );
}
