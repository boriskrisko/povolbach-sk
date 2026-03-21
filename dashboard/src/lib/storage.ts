import { readFileSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

export function readData<T>(file: string): T {
  const path = join(DATA_DIR, file);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as T;
}

export function writeData<T>(file: string, data: T): void {
  const path = join(DATA_DIR, file);
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, path);
}
