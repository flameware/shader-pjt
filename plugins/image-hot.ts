import path from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { IMAGE_UPDATED_EVENT, type ImageUpdatedPayload } from '../src/sketch/events.ts';
import { isImageFile } from '../src/sketch/images.ts';

/**
 * Hot reload for image Channels (#54). Saving an image under a Sketch folder would make Vite
 * reload the page (nothing accepts the image's module), which resets time and Parameters; this
 * swallows that update and tells the browser instead, which uploads the new image in place.
 * Creating or deleting an image is left alone: it changes the image glob, and that reload is the
 * one that rebuilds the pass graph.
 */
export function imageHotPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'shader-playground:image-hot',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    hotUpdate({ type, file, timestamp }) {
      if (type !== 'update' || this.environment.name !== 'client') return;
      const relative = path.posix.relative(normalizePath(root), normalizePath(file));
      if (!/^sketches\/[^/]+\/./.test(relative) || !isImageFile(relative)) return;
      const data: ImageUpdatedPayload = { path: relative, timestamp };
      this.environment.hot.send({ type: 'custom', event: IMAGE_UPDATED_EVENT, data });
      return [];
    },
  };
}
