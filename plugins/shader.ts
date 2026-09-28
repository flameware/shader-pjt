import path from 'node:path';
import type { Plugin } from 'vite';
import type { ShaderSource } from '../src/shader-source.ts';

/**
 * Hot updates of `.frag` modules reach the engine through this module. It has no file on
 * disk, so it never changes and never reloads; its listeners survive every shader save.
 */
export const SHADER_HOT_ID = 'virtual:shader-hot';
const RESOLVED_SHADER_HOT_ID = `\0${SHADER_HOT_ID}`;

const SHADER_HOT_CODE = `
const listeners = new Set();
export function onShaderUpdate(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function publishShaderUpdate(shader) {
  for (const listener of listeners) listener(shader);
}
`;

const FRAG = /\.frag$/;

/** The data a `.frag` module exports. `#include` expansion (#16) will grow `lines`/`files` here. */
export function shaderSource(code: string, file: string): ShaderSource {
  return {
    source: code,
    lines: code.split('\n').map((_, i) => [0, i + 1]),
    files: [file],
  };
}

/**
 * Turns each `.frag` file into a JS module exporting a `ShaderSource`. The module accepts its
 * own hot updates and hands the new source to `onShaderUpdate` listeners, so saving a `.frag`
 * swaps the shader without a page reload (a module nobody accepts would force a full reload).
 */
export function shaderPlugin(): Plugin {
  let root = process.cwd();

  return {
    name: 'shader-playground:shader',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === SHADER_HOT_ID ? RESOLVED_SHADER_HOT_ID : undefined;
    },
    load(id) {
      return id === RESOLVED_SHADER_HOT_ID ? SHADER_HOT_CODE : undefined;
    },
    transform(code, id) {
      const file = id.split('?', 1)[0]!;
      if (!FRAG.test(file)) return undefined;
      const shader = shaderSource(code, path.relative(root, file).split(path.sep).join('/'));
      return {
        code: [
          `import { publishShaderUpdate } from '${SHADER_HOT_ID}';`,
          `export default ${JSON.stringify(shader)};`,
          'if (import.meta.hot) {',
          '  import.meta.hot.accept((next) => { if (next) publishShaderUpdate(next.default); });',
          '}',
        ].join('\n'),
        map: null,
      };
    },
  };
}
