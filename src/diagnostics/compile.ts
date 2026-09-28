import { includeChain, type ShaderSource } from '../shader-source';
import type { Diagnostic } from './diagnostic';

/**
 * ANGLE (behind Chrome, Safari and Firefox) writes `ERROR: <string>:<line>: <message>`, with
 * `?` for an unknown line. Kept loose on purpose; lines that don't match are shown as they are.
 */
const LOCATED = /^(ERROR|WARNING):\s*\d+:(\d+|\?):\s*(.*)$/;
const UNLOCATED = /^(ERROR|WARNING):\s*(.*)$/;
/** ANGLE's closing tally, e.g. `ERROR: 2 compilation errors.  No code generated.` */
const SUMMARY = /^(ERROR|WARNING):\s*\d+ compilation (errors?|warnings?)\./;

/** Added when a failed compile's log has no `ERROR` line (empty, warnings only, or unparsed). */
const NO_ERROR_LINE_MESSAGE = '컴파일 실패 (로그에 에러 줄이 없음)';

/**
 * Turns a failed compile's info log into diagnostics against the original files.
 *
 * `prefixLines` is the number of engine lines in front of the body (see `wrapMainImage`).
 * Compiler line N maps through `shader.lines` to a file and line; lines outside the body
 * (engine prelude and `main()` wrapper) are reported against the Pass file with no line.
 */
export function compileDiagnostics(log: string, shader: ShaderSource, prefixLines: number): Diagnostic[] {
  const passFile = shader.files[0];
  const bodyLines = shader.source.split('\n');
  const diagnostics: Diagnostic[] = [];

  for (const raw of log.split('\n')) {
    const text = raw.replaceAll('\0', '').trim();
    if (text === '' || SUMMARY.test(text)) continue;

    const located = LOCATED.exec(text);
    const unlocated = located ? null : UNLOCATED.exec(text);
    const severity = (located?.[1] ?? unlocated?.[1]) === 'WARNING' ? 'warning' : 'error';
    const message = located?.[3] ?? unlocated?.[2] ?? text;

    const index = located && located[2] !== '?' ? Number(located[2]) - prefixLines - 1 : -1;
    const origin = shader.lines[index];
    if (origin) {
      const [fileIndex, line] = origin;
      const chain = includeChain(shader, fileIndex);
      diagnostics.push({
        severity,
        file: shader.files[fileIndex],
        line,
        message,
        sourceLine: bodyLines[index]?.trim() || undefined,
        ...(chain.length > 0 && { includeChain: chain }),
      });
    } else {
      diagnostics.push({ severity, file: passFile, message });
    }
  }

  if (!diagnostics.some((d) => d.severity === 'error')) {
    diagnostics.push({ severity: 'error', file: passFile, message: NO_ERROR_LINE_MESSAGE });
  }
  return diagnostics;
}
