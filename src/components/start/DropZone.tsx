import { Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { cx } from '../../lib/cx';
import { ImportError } from '../../lib/errors';
import { importKind, readImportFile, type ImportResult } from '../../lib/importFile';
import styles from './DropZone.module.css';

type Message = { text: string; error?: boolean } | null;

export function DropZone({ onImport }: { onImport: (result: ImportResult) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState<Message>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    try {
      importKind(file);
      setMsg({ text: `Reading ${file.name}…` });
      onImport(await readImportFile(file));
    } catch (e) {
      if (!(e instanceof ImportError)) console.error(e);
      setMsg({ text: e instanceof ImportError ? e.message : 'Couldn’t read that file.', error: true });
    }
  }

  const dragOver = (e: DragEvent) => {
    e.preventDefault();
    setOver(true);
  };
  const dragLeave = (e: DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
  };

  return (
    <>
      <button
        type="button"
        className={cx(styles.drop, over && styles.over)}
        onClick={() => input.current?.click()}
        onDragEnter={dragOver}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handle(e.dataTransfer.files[0]);
        }}
        aria-describedby="drop-msg"
      >
        <span className={styles.icon}>
          <Upload size={22} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className={styles.title}>Drop a playlist or saved plan</span>
        <span className={styles.sub}>
          or <u>browse files</u> · a playlist CSV (Exportify-style) or a saved <b>.mixplan.json</b>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv,.json,application/json"
        hidden
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div id="drop-msg" className={cx(styles.msg, msg?.error && styles.err)} role="status">
        {msg?.text}
      </div>
    </>
  );
}
