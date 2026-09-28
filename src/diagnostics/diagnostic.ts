/**
 * One problem to show in the banner. Every producer — shader compilation, include resolution,
 * Parameter parsing, the pass graph — reports in this shape, so the banner never needs to know
 * where a problem came from.
 */
export interface Diagnostic {
  /** `error` blocks the new version (the last good one keeps running); `warning` is only a notice. */
  severity: 'error' | 'warning';
  message: string;
  /** Project-relative path of the original file on disk, when known. */
  file?: string;
  /** 1-based line in `file`, when known. */
  line?: number;
  /** The text of the offending source line, trimmed. */
  sourceLine?: string;
}
