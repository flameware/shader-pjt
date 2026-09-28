import path from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { SKETCH_ADDED_EVENT, type SketchAddedPayload } from '../src/sketch/events.ts';
import { sketchNames } from '../src/sketch/pick.ts';

/**
 * The Sketch `file` makes new, if it is a top-level `main.frag` in a `sketches/` folder: a folder
 * becomes a Sketch when its Main pass exists (the rule `sketchNames` uses), so a folder made by
 * hand counts once its `main.frag` is saved.
 */
export function newSketchName(file: string, root: string): string | null {
  const relative = path.posix.relative(normalizePath(root), normalizePath(file));
  if (relative.startsWith('..')) return null;
  // The browser's own rule, applied to the root-relative path its glob would list.
  return sketchNames([`/${relative}`])[0] ?? null;
}

/**
 * Watches `sketches/` for new Sketch folders and tells the browser. The CLI (`npm run new`) never
 * talks to the server, so a copied or hand-made folder works the same way.
 *
 * The event goes out from the `create` hot update, before Vite's own full reload for the changed
 * `import.meta.glob` in `src/main.ts`; messages arrive in order, so the browser sees the event
 * first and records where to go before the page reloads.
 */
export function sketchWatchPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'shader-playground:sketch-watch',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    hotUpdate({ type, file }) {
      if (type !== 'create' || this.environment.name !== 'client') return;
      const name = newSketchName(file, root);
      if (name === null) return;
      const data: SketchAddedPayload = { name };
      this.environment.hot.send({ type: 'custom', event: SKETCH_ADDED_EVENT, data });
    },
  };
}
