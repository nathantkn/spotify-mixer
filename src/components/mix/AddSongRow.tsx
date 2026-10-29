import styles from './MixView.module.css';

export function AddSongRow({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.addsong} onClick={onClick}>
      <span className={styles.plus} aria-hidden="true">
        +
      </span>
      Add song
    </button>
  );
}
