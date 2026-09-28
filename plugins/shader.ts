import path from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { expandPass, type IncludeRoots } from './include.ts';

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

/** Where the `lib/` and `lygia/` include prefixes point (ADR-0005). */
function includeRoots(root: string): IncludeRoots {
  return { project: root, lib: path.join(root, 'lib'), lygia: path.join(root, 'node_modules', 'lygia') };
}

/**
 * Turns each `.frag` file into a JS module exporting a `ShaderSource`. The module accepts its
 * own hot updates and hands the new source to `onShaderUpdate` listeners, so saving a `.frag`
 * swaps the shader without a page reload (a module nobody accepts would force a full reload).
 * `#include`s are expanded here (see `include.ts`), and saving or creating an included file
 * hot-updates every Pass that includes it.
 */
export function shaderPlugin(): Plugin {
  let roots = includeRoots(process.cwd());
  /** Included (or missing) file → the `.frag` files whose expansion depends on it. */
  const dependents = new Map<string, Set<string>>();

  return {
    name: 'shader-playground:shader',
    enforce: 'pre',
    configResolved(config) {
      roots = includeRoots(config.root);
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
      const { shader, watchFiles, missingFiles } = expandPass(file, code, roots);
      for (const watched of watchFiles) this.addWatchFile(watched);
      for (const passes of dependents.values()) passes.delete(file);
      for (const dep of [...watchFiles, ...missingFiles].map(normalizePath)) {
        const passes = dependents.get(dep) ?? new Set<string>();
        dependents.set(dep, passes.add(file));
      }
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
    // addWatchFile covers saving an included file. A missing include isn't in the module graph,
    // so creating it (or deleting an include) is routed to the Passes that asked for it here.
    hotUpdate({ file, modules }) {
      const passes = dependents.get(file);
      if (!passes?.size) return undefined;
      const graph = this.environment.moduleGraph;
      const passModules = [...passes].flatMap((pass) => [...(graph.getModulesByFile(pass) ?? [])]);
      return [...new Set([...modules, ...passModules])];
    },
  };
}
