import type { Diagnostic } from '../diagnostics/diagnostic';

/** A Pass name is its `.frag` file name without the extension (#5). */
const PASS_NAME = /^[a-z][a-z0-9_]*$/;

/** Project-relative path of a Sketch's optional `sketch.ts`. */
export function sketchConfigFile(name: string): string {
  return `sketches/${name}/sketch.ts`;
}

/**
 * The Passes of Sketch `name`, from the `/sketches/…/*.frag` paths Vite's glob sees: every
 * top-level `.frag` with a valid name. `.frag` files in subfolders, or with names that aren't
 * valid Pass names, are ignored with a warning.
 */
export function sketchPassFiles(
  name: string,
  fragPaths: readonly string[],
): { passFiles: Record<string, string>; diagnostics: Diagnostic[] } {
  const folder = `sketches/${name}/`;
  const passFiles: Record<string, string> = {};
  const diagnostics: Diagnostic[] = [];

  for (const file of fragPaths.map((p) => p.replace(/^\//, '')).sort()) {
    if (!file.startsWith(folder)) continue;
    const rest = file.slice(folder.length);
    if (rest.includes('/')) {
      diagnostics.push({ severity: 'warning', file, message: '하위 폴더의 .frag는 Pass가 아니므로 무시합니다 (Pass는 Sketch 폴더 최상위 .frag만)' });
      continue;
    }
    const pass = rest.replace(/\.frag$/, '');
    if (!PASS_NAME.test(pass)) {
      diagnostics.push({ severity: 'warning', file, message: `Pass 이름은 [a-z][a-z0-9_]* 이어야 하므로 '${pass}'는 무시합니다` });
      continue;
    }
    passFiles[pass] = file;
  }
  return { passFiles, diagnostics };
}
