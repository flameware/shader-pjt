import {
  DEFAULT_OUTPUT,
  OUTPUT_PRESETS,
  type OutputPreset,
  type OutputSize,
  type RenderScale,
  effectiveRenderScale,
  isRenderScale,
  outputKey,
  parseOutputSize,
  sameOutput,
} from './output-size';

/**
 * A Sketch's Output size and render scale (#8 decisions 1, 3). Each starts from the `sketch.ts`
 * default (`output`, else `window`) and `fit`; the user's choice is kept per Sketch in
 * `localStorage`. Like a Parameter value, the stored choice is dropped when the `sketch.ts`
 * default it was made against changes.
 */
export interface OutputSettings {
  output(): OutputSize;
  /** The render scale in effect: always `fit` for `window`. */
  renderScale(): RenderScale;
  /** What the user can pick: `window`, the presets, and the `sketch.ts` `[w, h]` if it has one. */
  options(): readonly OutputSize[];
  /** Ignored unless it is one of `options()`. Going to `window` also goes back to `fit`. */
  setOutput(output: OutputSize): void;
  /** Ignored for `window`. */
  setRenderScale(scale: RenderScale): void;
  /** Called after a change that takes effect (the caller resets the Sketch). */
  subscribe(listener: () => void): () => void;
}

interface Stored {
  /** `outputKey` of the `sketch.ts` default the choice was made against. */
  default: string;
  output: OutputSize;
  renderScale: RenderScale;
}

const KEY_PREFIX = 'shader-playground:output:';

function read(storage: Storage, key: string): Partial<Stored> {
  try {
    const raw: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    return typeof raw === 'object' && raw !== null ? (raw as Partial<Stored>) : {};
  } catch {
    return {};
  }
}

export function createOutputSettings(sketch: string, storage: Storage, sketchDefault: OutputSize = DEFAULT_OUTPUT): OutputSettings {
  const key = KEY_PREFIX + sketch;
  const options: OutputSize[] = ['window', ...(Object.keys(OUTPUT_PRESETS) as OutputPreset[])];
  if (typeof sketchDefault !== 'string') options.push(sketchDefault);
  const offered = (value: OutputSize | undefined): value is OutputSize => value !== undefined && options.some((o) => sameOutput(o, value));

  let output = sketchDefault;
  let scale: RenderScale = 'fit';
  const stored = read(storage, key);
  if (stored.default === outputKey(sketchDefault)) {
    const storedOutput = parseOutputSize(stored.output);
    if (offered(storedOutput)) output = storedOutput;
    if (isRenderScale(stored.renderScale)) scale = effectiveRenderScale(output, stored.renderScale);
  }

  const listeners = new Set<() => void>();
  const changed = () => {
    try {
      const value: Stored = { default: outputKey(sketchDefault), output, renderScale: scale };
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // kept in memory only
    }
    for (const listener of listeners) listener();
  };

  return {
    output: () => output,
    renderScale: () => scale,
    options: () => options,
    setOutput(next) {
      if (!offered(next) || sameOutput(next, output)) return;
      output = next;
      scale = effectiveRenderScale(output, scale);
      changed();
    },
    setRenderScale(next) {
      const effective = effectiveRenderScale(output, next);
      if (effective === scale) return;
      scale = effective;
      changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
