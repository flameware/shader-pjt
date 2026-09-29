import { type MaxLength, isMaxLength } from './length';

/**
 * A Sketch's Recording max length (#42 decision 2), kept per Sketch in `localStorage` the same
 * way as the Output settings (`src/output/settings.ts`). Starts at "없음" (`null`).
 */
export interface RecordingSettings {
  maxLength(): MaxLength;
  /** Ignored unless it is one of `MAX_LENGTHS`. */
  setMaxLength(maxLength: MaxLength): void;
  /** Called after a change. */
  subscribe(listener: () => void): () => void;
}

const KEY_PREFIX = 'shader-playground:recording:';

function readMaxLength(storage: Storage, key: string): MaxLength {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    const value = typeof raw === 'object' && raw !== null ? (raw as { maxLength?: unknown }).maxLength : undefined;
    return isMaxLength(value) ? value : null;
  } catch {
    return null;
  }
}

export function createRecordingSettings(sketch: string, storage: Storage): RecordingSettings {
  const key = KEY_PREFIX + sketch;
  let maxLength = readMaxLength(storage, key);
  const listeners = new Set<() => void>();

  return {
    maxLength: () => maxLength,
    setMaxLength(next) {
      if (!isMaxLength(next) || next === maxLength) return;
      maxLength = next;
      try {
        storage.setItem(key, JSON.stringify({ maxLength }));
      } catch {
        // kept in memory only
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
