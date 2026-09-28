/**
 * Output size (#8 decisions 1–3): the shape and pixel dimensions a Sketch is composed for and
 * captured at. `window` follows the browser window; a preset or a `sketch.ts` `[w, h]` fixes it,
 * and the screen letterboxes to its aspect ratio.
 */

/** 2× the usual 1080 SNS sizes, and no longer than 4096 on either side, so no tiling is needed. */
export const OUTPUT_PRESETS = {
  '1:1': [2160, 2160],
  '4:5': [2160, 2700],
  '9:16': [2160, 3840],
  '16:9': [3840, 2160],
} as const satisfies Record<string, readonly [number, number]>;

export type OutputPreset = keyof typeof OUTPUT_PRESETS;

/** `sketch.ts` notation: `'window'`, a preset name, or `[w, h]` in pixels. */
export type OutputSize = 'window' | OutputPreset | readonly [number, number];

/**
 * How big the working resolution is for a fixed Output size: `fit` renders the pixels the screen
 * shows (CSS size × min(dpr, 2)); `full` renders at the Output size and the screen scales it down.
 * `window` is always `fit`.
 */
export type RenderScale = 'fit' | 'full';

export const DEFAULT_OUTPUT: OutputSize = 'window';

const isPreset = (value: unknown): value is OutputPreset => typeof value === 'string' && Object.hasOwn(OUTPUT_PRESETS, value);
const isPixels = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

/** The value if it is valid Output size notation, otherwise `undefined`. */
export function parseOutputSize(value: unknown): OutputSize | undefined {
  if (value === 'window' || isPreset(value)) return value;
  if (Array.isArray(value) && value.length === 2 && value.every(isPixels)) return [value[0], value[1]];
  return undefined;
}

export const isRenderScale = (value: unknown): value is RenderScale => value === 'fit' || value === 'full';

/** Pixel size of a fixed Output size; `null` for `window`. */
export function outputPixels(output: OutputSize): readonly [number, number] | null {
  if (output === 'window') return null;
  return isPreset(output) ? OUTPUT_PRESETS[output] : output;
}

/** A string that identifies an Output size: `window`, `4:5`, `640x480` (dropdown value, Capture metadata). */
export function outputKey(output: OutputSize): string {
  return typeof output === 'string' ? output : `${output[0]}x${output[1]}`;
}

/** How the Output size reads in the UI: `window`, `4:5 · 2160×2700`, `640×480`. */
export function outputLabel(output: OutputSize): string {
  if (output === 'window') return 'window';
  const [w, h] = outputPixels(output)!;
  return typeof output === 'string' ? `${output} · ${w}×${h}` : `${w}×${h}`;
}

export const sameOutput = (a: OutputSize, b: OutputSize) => outputKey(a) === outputKey(b);

/** The render scale in effect: `window` is always `fit`. */
export const effectiveRenderScale = (output: OutputSize, scale: RenderScale): RenderScale => (output === 'window' ? 'fit' : scale);
