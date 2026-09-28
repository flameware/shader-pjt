import fs from 'node:fs';
import path from 'node:path';
import type { Diagnostic } from '../src/diagnostics/diagnostic.ts';
import { includeChain, type ShaderSource } from '../src/shader-source.ts';

/**
 * `#include` resolution for one Pass (ADR-0005, #7). The first path segment alone decides
 * where a path points: `lib/…` is the project's `lib/`, `lygia/…` is the lygia package, and
 * anything else is relative to the including file. There is no search path and no fallback.
 */

/** Absolute folders the include prefixes point at. */
export interface IncludeRoots {
  /** Repo root; diagnostics and `files` use paths relative to it. */
  project: string;
  /** Target of the `lib/` prefix. */
  lib: string;
  /** Target of the `lygia/` prefix (normally `node_modules/lygia`). */
  lygia: string;
}

export interface ExpandedPass {
  shader: ShaderSource;
  /** Absolute paths of every included file that was read. A change to any must re-expand the Pass. */
  watchFiles: string[];
  /** Absolute paths an include pointed at that don't exist. Creating one must re-expand the Pass. */
  missingFiles: string[];
}

/** The folder a file's relative includes may not leave. */
interface Root {
  kind: 'sketch' | 'lib' | 'lygia';
  dir: string;
}

const ROOT_NAME: Record<Root['kind'], string> = { sketch: 'Sketch 폴더', lib: 'lib/', lygia: 'lygia 패키지' };

/**
 * Text-only on purpose (#7): a `//`-commented include doesn't start with `#`, while `/* *\/`
 * block comments and `#if` are not tracked, so includes inside them are still expanded.
 */
const INCLUDE = /^\s*#\s*include\b(.*)$/;
/** `"path"`, optionally followed by a `//` comment. */
const QUOTED = /^"([^"]*)"\s*(\/\/.*)?$/;
const ANGLED = /^<[^>]*>/;
const VERSION = /^\s*#\s*version\b/;

const LYGIA_INSTALL = 'npm i -D -E lygia@1.4.1';

type Target = { abs: string; real: string; root: Root } | { error: string; missing?: string };

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines;
}

/** True when `abs` is strictly inside `dir` (lexically; resolve symlinks first to compare real paths). */
function inside(dir: string, abs: string): boolean {
  const rel = path.relative(dir, abs);
  return rel !== '' && rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel);
}

function realpath(abs: string): string {
  try {
    return fs.realpathSync(abs);
  } catch {
    return path.resolve(abs);
  }
}

/**
 * Walks from `dir` to `abs` one directory listing at a time, so a wrong-case name fails even on
 * a case-insensitive file system (macOS) instead of breaking only on Linux/CI.
 */
function findExact(dir: string, abs: string): 'found' | 'missing' | { actual: string } {
  let current = dir;
  let caseDiffers = false;
  for (const segment of path.relative(dir, abs).split(path.sep)) {
    let entries: string[];
    try {
      entries = fs.readdirSync(current);
    } catch {
      return 'missing';
    }
    let name = segment;
    if (!entries.includes(segment)) {
      const other = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
      if (other === undefined) return 'missing';
      name = other;
      caseDiffers = true;
    }
    current = path.join(current, name);
  }
  // statSync follows symlinks, so a dangling link throws; that is a missing file too.
  if (!fs.statSync(current, { throwIfNoEntry: false })?.isFile()) return 'missing';
  return caseDiffers ? { actual: current } : 'found';
}

/**
 * Expands every `#include` in a Pass. `passFile` is the absolute path of the `.frag`, `code`
 * its contents. Each file (by real path) is expanded at most once per Pass; a later include of
 * it expands to nothing. Resolve problems are collected into `shader.resolveErrors`, each at
 * the include line's own file and line, with the include chain that led there.
 */
export function expandPass(passFile: string, code: string, roots: IncludeRoots): ExpandedPass {
  const files: string[] = [];
  const includedFrom: ([number, number] | null)[] = [];
  const source: string[] = [];
  const lines: [number, number][] = [];
  const errors: Diagnostic[] = [];
  const expanded = new Set<string>();
  /** Real paths of the files currently being expanded, outermost first; a repeat is a cycle. */
  const stack: string[] = [];
  const watchFiles = new Set<string>();
  const missingFiles = new Set<string>();

  const relative = (abs: string) => path.relative(roots.project, abs).split(path.sep).join('/');

  function resolve(spec: string, includer: string, root: Root): Target {
    if (ANGLED.test(spec)) return { error: '#include <...> 형식은 쓸 수 없습니다. #include "경로"를 쓰세요' };
    const quoted = QUOTED.exec(spec);
    if (!quoted) return { error: '#include 줄을 해석할 수 없습니다. #include "경로" 형식을 쓰세요' };
    const wanted = quoted[1]!;
    if (wanted.startsWith('/') || path.isAbsolute(wanted)) return { error: `절대경로는 쓸 수 없습니다: "${wanted}"` };
    if (wanted.endsWith('.frag')) return { error: `.frag는 include할 수 없습니다: "${wanted}" (공유할 코드는 .glsl로 빼세요)` };
    if (!wanted.endsWith('.glsl')) return { error: `확장자 .glsl을 적어야 합니다: "${wanted}"` };

    // Prefixes apply only outside lygia; lygia's own includes are all relative (ADR-0005).
    const prefix = root.kind === 'lygia' ? undefined : wanted.split('/')[0];
    let target: Root;
    let abs: string;
    if (prefix === 'lib') {
      target = { kind: 'lib', dir: roots.lib };
      abs = path.join(roots.lib, wanted.slice('lib/'.length));
    } else if (prefix === 'lygia') {
      if (root.kind === 'lib') return { error: `lib/ 파일은 lygia/를 include할 수 없습니다 (ADR-0003): "${wanted}"` };
      if (!fs.existsSync(roots.lygia)) {
        return { error: `"${wanted}" — ${relative(roots.lygia)}가 없습니다 (${LYGIA_INSTALL})` };
      }
      target = { kind: 'lygia', dir: roots.lygia };
      abs = path.join(roots.lygia, wanted.slice('lygia/'.length));
    } else {
      target = root;
      abs = path.resolve(path.dirname(includer), wanted);
    }

    if (!inside(target.dir, abs)) return { error: `${ROOT_NAME[target.kind]} 밖으로 나가는 경로입니다: "${wanted}"` };
    const found = findExact(target.dir, abs);
    if (found === 'missing') return { error: `파일 없음: "${wanted}"`, missing: abs };
    if (found !== 'found') {
      return { error: `대소문자가 실제 파일명과 다릅니다: "${wanted}" (실제 파일: ${relative(found.actual)})` };
    }
    // Judged on real paths too, so a symlink can't smuggle a file in from outside the root.
    const real = realpath(abs);
    if (!inside(realpath(target.dir), real)) {
      return { error: `${ROOT_NAME[target.kind]} 밖을 가리키는 symlink입니다: "${wanted}"` };
    }
    return { abs, real, root: target };
  }

  function expandFile(abs: string, real: string, text: string, root: Root, from: [number, number] | null): void {
    const index = files.push(relative(abs)) - 1;
    includedFrom.push(from);
    expanded.add(real);
    stack.push(real);
    const chain = includeChain({ files, includedFrom }, index);

    splitLines(text).forEach((lineText, i) => {
      const line = i + 1;
      const fail = (message: string, withChain = true) =>
        errors.push({
          severity: 'error',
          file: files[index],
          line,
          message,
          sourceLine: lineText.trim() || undefined,
          includeChain: withChain && chain.length > 0 ? chain : undefined,
        });

      // Only the user's own files are checked; lygia never has #version (#7).
      if (root.kind !== 'lygia' && VERSION.test(lineText)) return fail('#version은 엔진이 붙입니다. 이 줄을 지우세요');
      const include = INCLUDE.exec(lineText);
      if (!include) {
        source.push(lineText);
        lines.push([index, line]);
        return;
      }

      const target = resolve(include[1]!.trim(), abs, root);
      if ('error' in target) {
        if (target.missing) missingFiles.add(target.missing);
        return fail(target.error);
      }
      if (stack.includes(target.real)) {
        const cycle = [...chain, `${files[index]}:${line}`, relative(target.abs)];
        return fail(`include 순환: ${cycle.join(' → ')}`, false);
      }
      if (expanded.has(target.real)) return; // include-once: a second include expands to nothing
      watchFiles.add(target.abs);
      expandFile(target.abs, target.real, fs.readFileSync(target.abs, 'utf8'), target.root, [index, line]);
    });

    stack.pop();
  }

  const passAbs = path.resolve(passFile);
  expandFile(passAbs, realpath(passAbs), code, { kind: 'sketch', dir: path.dirname(passAbs) }, null);

  const shader: ShaderSource = { source: source.join('\n'), lines, files };
  if (files.length > 1) shader.includedFrom = includedFrom;
  if (errors.length > 0) shader.resolveErrors = errors;
  return { shader, watchFiles: [...watchFiles], missingFiles: [...missingFiles] };
}
