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
}
