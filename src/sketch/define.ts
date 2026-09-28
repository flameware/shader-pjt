/**
 * The API a Sketch's optional `sketch.ts` imports as `playground` (a Vite alias and a tsconfig
 * path, not a relative import — #12). The types guide authoring; the engine still validates the
 * value at runtime (`buildPassGraph`), since a typo in a `.ts` file only shows up in the editor.
 */

/** Reads a Pass's output from the previous frame (Feedback). Zero until the Pass has run once. */
export interface PrevRef {
  readonly prev: string;
}

/** What a Channel reads: a Pass's output this frame (by name), or last frame's via `prev()`. */
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
  /** Size relative to the canvas; default 1. Not allowed together with `size`, nor on `main`. */
  scale?: number;
  /** Fixed size in pixels. Not allowed together with `scale`, nor on `main`. */
  size?: [number, number];
}

export interface SketchConfig {
  title?: string;
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
