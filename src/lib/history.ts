import { File, Paths } from 'expo-file-system';

export type ProgressEntry = {
  position: number;
  duration: number;
  updatedAt: number;
};

export type HistoryMap = Record<string, ProgressEntry>;

const HISTORY_FILE = new File(Paths.document, 'history.json');

let cached: HistoryMap | null = null;

function load(): HistoryMap {
  if (cached) {
    return cached;
  }
  if (!HISTORY_FILE.exists) {
    cached = {};
    return cached;
  }
  try {
    cached = JSON.parse(HISTORY_FILE.textSync()) as HistoryMap;
  } catch {
    cached = {};
  }
  return cached;
}

export function readHistory(): HistoryMap {
  return { ...load() };
}

export function saveProgress(id: string, position: number, duration: number): void {
  if (!Number.isFinite(position) || position < 0 || !Number.isFinite(duration) || duration <= 0) {
    return;
  }
  const all = load();
  all[id] = { position, duration, updatedAt: Date.now() };
  cached = all;
  if (!HISTORY_FILE.exists) {
    HISTORY_FILE.create();
  }
  HISTORY_FILE.write(JSON.stringify(all));
}
