import styles from './sheetBody.module.css';

export function FactCard({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className={styles.fact}>
      <div className={styles.k}>{label}</div>
      <div className={styles.v}>{value}</div>
      {sub && (
        <div className={styles.s} style={{ color: subColor }}>
          {sub}
        </div>
      )}
    </div>
  );
}
