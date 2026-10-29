import { titleFromFileName, tracksFromCSV } from './csv';
import { ImportError } from './errors';
import { newId } from './format';
import { parsePlanJson } from './planFile';
import type { PlanState } from './types';

export type ImportResult = { kind: 'csv' | 'json'; plan: PlanState };

interface FileLike { name: string; type: string }

export function importKind(file: FileLike): 'csv' | 'json' {
  if (/\.json$/i.test(file.name) || file.type === 'application/json') return 'json';
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return 'csv';
  throw new ImportError('Use a playlist .csv or a saved .mixplan.json file.');
}

export function importText(file: FileLike, text: string): ImportResult {
  const kind = importKind(file);
  if (kind === 'json') return { kind, plan: parsePlanJson(text) };
  return {
    kind,
    plan: { id: newId('plan'), title: titleFromFileName(file.name), tracks: tracksFromCSV(text), notes: {} },
  };
}

export async function readImportFile(file: File): Promise<ImportResult> {
  importKind(file); // reject the wrong type before reading
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ImportError('Couldn’t read that file.');
  }
  return importText(file, text);
}
