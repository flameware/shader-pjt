/**
 * The HMR custom event the dev server sends when a new Sketch appears (#12 decision 10); the
 * browser switches to it. Sent by `plugins/sketch-watch.ts`; the `CustomEventMap` entry below
 * types it for `import.meta.hot.on` and `hot.send`.
 */
export const SKETCH_ADDED_EVENT = 'shader-playground:sketch-added';

export interface SketchAddedPayload {
  /** The new Sketch's folder name under `sketches/`. */
  name: string;
}

declare module 'vite/types/customEvent.d.ts' {
  interface CustomEventMap {
    'shader-playground:sketch-added': SketchAddedPayload;
  }
}
