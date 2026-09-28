import { type ParamGlslType, type ParamSpec, type ParamValue, formatAnnotation } from './annotation';

/** A Parameter of the Sketch: its uniform name and type, and what its annotation says. */
export interface Parameter {
  name: string;
  type: ParamGlslType;
  spec: ParamSpec;
}

/** One Parameter as the GPU takes it: `data` has 1 to 4 numbers (bool as 0/1, select as its index). */
export interface ParameterUniform {
  name: string;
  type: ParamGlslType;
  data: number[];
}

/**
 * The current value of each Parameter of one Sketch, kept in `localStorage` under the Sketch
 * name + Parameter name (#6 decisions 6, 7). Values are in annotation notation (see
 * `annotation.ts`), which is also what Capture metadata stores.
 */
export interface ParameterValues {
  /**
   * Replaces the Parameter list (after a hot swap or on load) and carries each value over by the
   * invalidation rules. `complete` says every Pass's declarations are known; only then are stored
   * values whose declaration is gone deleted, so a Pass that fails to build doesn't wipe them.
   */
  setParameters(parameters: readonly Parameter[], options: { complete: boolean }): void;
  list(): readonly Parameter[];
  get(name: string): ParamValue | undefined;
  /** Sets a value from the GUI. Out-of-range numbers are clamped; a value of the wrong shape is ignored. */
  set(name: string, value: ParamValue): void;
  /** "기본값으로": every Parameter back to its declared default. */
  resetAll(): void;
  /** Name → value, for Capture metadata (color hex, select name, vec2 `[x, y]`). */
  snapshot(): Record<string, ParamValue>;
  /** "현재 값 복사": one `uniform … // @param …` line per Parameter, the current value as its default. */
  copyText(): string;
  /** What to upload each frame. */
  uniforms(): readonly ParameterUniform[];
  subscribe(listener: (change: { listChanged: boolean }) => void): () => void;
}

interface Stored {
  spec: ParamSpec;
  value: ParamValue;
}

const KEY_PREFIX = 'shader-playground:param:';
const clamp = (v: number, min = -Infinity, max = Infinity) => Math.min(max, Math.max(min, v));
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;

/** `value` made to fit `spec` (clamped, rounded), or `undefined` when it is the wrong shape. */
function fit(spec: ParamSpec, value: unknown): ParamValue | undefined {
  switch (spec.kind) {
    case 'float':
      return isNumber(value) ? clamp(value, spec.min, spec.max) : undefined;
    case 'int':
      return isNumber(value) ? clamp(Math.round(value), spec.min, spec.max) : undefined;
    case 'bool':
      return typeof value === 'boolean' ? value : undefined;
    case 'color': {
      if (typeof value !== 'string') return undefined;
      const hex = value.toLowerCase();
      return HEX.test(hex) && hex.length === (spec.alpha ? 9 : 7) ? hex : undefined;
    }
    case 'vec2':
      return Array.isArray(value) && value.length === 2 && value.every(isNumber)
        ? [clamp(value[0]!, spec.min, spec.max), clamp(value[1]!, spec.min, spec.max)]
        : undefined;
    case 'select':
      return typeof value === 'string' && spec.options.includes(value) ? value : undefined;
  }
}

/**
 * A previous value carried over to a new declaration (#6 decision 7): dropped when the kind or
 * the default changed, clamped into a new range, and a select choice looked up by name.
 */
export function carryOver(previous: Stored | undefined, spec: ParamSpec): ParamValue {
  if (!previous || previous.spec.kind !== spec.kind) return spec.default;
  if (spec.kind === 'color' && (previous.spec as { alpha?: boolean }).alpha !== spec.alpha) return spec.default;
  if (!sameJson(previous.spec.default, spec.default)) return spec.default;
  return fit(spec, previous.value) ?? spec.default;
}

function hexToFloats(hex: string): number[] {
  const bytes = hex.slice(1).match(/../g) ?? [];
  return bytes.map((b) => parseInt(b, 16) / 255);
}

function toUniform({ name, type, spec }: Parameter, value: ParamValue): ParameterUniform {
  let data: number[];
  if (spec.kind === 'select') data = [spec.options.indexOf(value as string)];
  else if (spec.kind === 'color') data = hexToFloats(value as string);
  else if (typeof value === 'boolean') data = [value ? 1 : 0];
  else data = Array.isArray(value) ? [...value] : [value as number];
  return { name, type, data };
}

/** A `Storage` kept in memory: the fallback when `localStorage` is unavailable, and for tests. */
export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

/** `localStorage` when the browser lets us use it; otherwise values last only for this page. */
export function browserStorage(): Storage {
  try {
    const storage = globalThis.localStorage;
    storage.getItem(KEY_PREFIX);
    return storage;
  } catch {
    return memoryStorage();
  }
}

export function createParameterValues(sketch: string, storage: Storage): ParameterValues {
  const prefix = `${KEY_PREFIX}${sketch}:`;
  let parameters: readonly Parameter[] = [];
  /** Current value and the spec it was set under, for every listed Parameter. */
  let current = new Map<string, Stored>();
  let uniforms: ParameterUniform[] = [];
  const listeners = new Set<(change: { listChanged: boolean }) => void>();

  // Storage can throw (disabled, private mode, quota); values then just live for this page.
  const read = (name: string): Stored | undefined => {
    try {
      const text = storage.getItem(prefix + name);
      const parsed: unknown = text === null ? undefined : JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null && 'spec' in parsed && 'value' in parsed ? (parsed as Stored) : undefined;
    } catch {
      return undefined;
    }
  };
  const write = (name: string, stored: Stored) => {
    try {
      storage.setItem(prefix + name, JSON.stringify(stored));
    } catch {
      // kept in memory only
    }
  };
  const prune = (keep: Set<string>) => {
    try {
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
      for (const key of keys) {
        if (key?.startsWith(prefix) && !keep.has(key.slice(prefix.length))) storage.removeItem(key);
      }
    } catch {
      // nothing stored to prune
    }
  };

  const changed = (listChanged: boolean) => {
    uniforms = parameters.map((p) => toUniform(p, current.get(p.name)!.value));
    for (const listener of listeners) listener({ listChanged });
  };

  return {
    setParameters(declared, { complete }) {
      // Only what the GUI shows counts; a declaration moving to another line is no change.
      const next = declared.map(({ name, type, spec }) => ({ name, type, spec }));
      const listChanged = !sameJson(next, parameters);
      const carried = new Map<string, Stored>();
      for (const { name, spec } of next) {
        const stored = { spec, value: carryOver(current.get(name) ?? read(name), spec) };
        carried.set(name, stored);
        write(name, stored);
      }
      parameters = next;
      current = carried;
      if (complete) prune(new Set(current.keys()));
      changed(listChanged);
    },
    list: () => parameters,
    get: (name) => current.get(name)?.value,
    set(name, value) {
      const entry = current.get(name);
      const fitted = entry && fit(entry.spec, value);
      if (!entry || fitted === undefined) return;
      entry.value = fitted;
      write(name, entry);
      changed(false);
    },
    resetAll() {
      for (const [name, entry] of current) {
        entry.value = entry.spec.default;
        write(name, entry);
      }
      changed(false);
    },
    snapshot: () => Object.fromEntries(parameters.map(({ name }) => [name, current.get(name)!.value])),
    copyText() {
      const typeWidth = Math.max(0, ...parameters.map((p) => p.type.length));
      const heads = parameters.map(({ name, type }) => `uniform ${type.padEnd(typeWidth)} ${name};`);
      const width = Math.max(0, ...heads.map((h) => h.length));
      return parameters
        .map(({ name, spec }, i) => `${heads[i]!.padEnd(width)} // @param ${formatAnnotation(spec, current.get(name)!.value)}\n`)
        .join('');
    },
    uniforms: () => uniforms,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
