/**
 * The API a Sketch's optional `sketch.ts` imports as `playground` (a Vite alias and a tsconfig
 * path, not a relative import — #12). The types guide authoring; the engine still validates the
 * value at runtime (`buildPassGraph`), since a typo in a `.ts` file only shows up in the editor.
 */

import type { OutputSize } from '../output/output-size';

/** Reads a Pass's output from the previous frame (Feedback). Zero until the Pass has run once. */
export interface PrevRef {
  readonly prev: string;
}

/**
 * What a Channel reads: a Pass's output this frame (by name), last frame's via `prev()`, or an
 * image file of the Sketch folder by a path starting with `./` (png, jpg, jpeg, webp; #54). An
 * image is cropped to cover the render size, so `texture(iChannelN, fragCoord / iResolution.xy)`
 * lays it over the canvas.
 */
export type ChannelSource = string | PrevRef;

export type BufferFormat = 'rgba8' | 'rgba16f' | 'rgba32f';
export type BufferFilter = 'linear' | 'nearest';
export type BufferWrap = 'clamp' | 'repeat' | 'mirror';

export interface PassConfig {
  /** Position in the array is the `iChannelN` slot; at most 4. */
  channels?: ChannelSource[];
  /** Default `rgba16f`. Not allowed on `main` (its buffer is always `rgba16f`). */
  format?: BufferFormat;
  /** Default `linear`, or `nearest` for `rgba32f`. */
  filter?: BufferFilter;
  /** Default `clamp`. */
  wrap?: BufferWrap;
  /** Size relative to the render size (the working resolution); default 1. Not allowed together with `size`, nor on `main`. */
  scale?: number;
  /** Fixed size in pixels. Not allowed together with `scale`, nor on `main`. */
  size?: [number, number];
}

export interface SketchConfig {
  title?: string;
  /**
   * The default Output size: `'window'` (default), a preset (`'1:1'` 2160×2160, `'4:5'` 2160×2700,
   * `'9:16'` 2160×3840, `'16:9'` 3840×2160) or `[w, h]` in pixels. The user's choice in the
   * panel is remembered per Sketch and wins over this until this default changes.
   */
  output?: OutputSize;
  /** Keyed by Pass name (the `.frag` file name without extension). */
  passes?: Record<string, PassConfig>;
}

/** Declares a Sketch's Passes: `export default defineSketch({ passes: { main: { channels: ['blur'] } } })`. */
export function defineSketch(config: SketchConfig): SketchConfig {
  return config;
}

/** Feedback: `prev('main')` in a Channel list reads `main`'s output from the previous frame. */
export function prev(pass: string): PrevRef {
  return { prev: pass };
}
