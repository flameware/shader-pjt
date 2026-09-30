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

/**
 * The HMR custom event the dev server sends when an image file under `sketches/` is saved (#54);
 * the browser uploads it again in place of a page reload. Sent by `plugins/image-hot.ts`.
 */
export const IMAGE_UPDATED_EVENT = 'shader-playground:image-updated';

export interface ImageUpdatedPayload {
  /** Project-relative path of the image. */
  path: string;
  /** When the file changed, to fetch past the browser cache. */
  timestamp: number;
}

declare module 'vite/types/customEvent.d.ts' {
  interface CustomEventMap {
    'shader-playground:sketch-added': SketchAddedPayload;
    'shader-playground:image-updated': ImageUpdatedPayload;
  }
}
