import type { Diagnostic } from './diagnostics/diagnostic.ts';

/**
 * What a `.frag` module exports (see `plugins/shader.ts`): the Pass body ready for the engine
 * to wrap, plus a line table that maps each body line back to a file and line on disk.
 */
export interface ShaderSource {
  /** The Pass body after include expansion (`mainImage` only; the engine adds the rest). */
  source: string;
  /** `lines[i]` is `[fileIndex, line]` (1-based line) for line i + 1 of `source`. */
  lines: [number, number][];
  /** Project-relative paths, indexed by `fileIndex`. `files[0]` is the Pass's own `.frag`. */
  files: string[];
  /**
   * `includedFrom[k]` is the `[fileIndex, line]` of the `#include` line that expanded
   * `files[k]`; `null` for the Pass itself. Each file is expanded at most once per Pass, so
   * this gives every file exactly one include chain. Absent when nothing was included.
   */
  includedFrom?: ([number, number] | null)[];
  /**
   * Problems found while resolving `#include`s (missing file, cycle, root escape, ...). When
   * present, `source` is incomplete and must not be compiled; the last good version keeps running.
   */
  resolveErrors?: Diagnostic[];
}

/**
 * How `files[fileIndex]` got into the Pass: the `file:line` of each `#include` line from the
 * Pass down to it. Empty for the Pass itself.
 */
export function includeChain(shader: Pick<ShaderSource, 'files' | 'includedFrom'>, fileIndex: number): string[] {
  const chain: string[] = [];
  for (let at = shader.includedFrom?.[fileIndex]; at; at = shader.includedFrom?.[at[0]]) {
    chain.unshift(`${shader.files[at[0]]}:${at[1]}`);
  }
  return chain;
}
