import type { ShaderSource } from '../shader-source';
import type { Diagnostic } from './diagnostic';

/**
 * ANGLE (behind Chrome, Safari and Firefox) writes `ERROR: <string>:<line>: <message>`, with
 * `?` for an unknown line. Kept loose on purpose; lines that don't match are shown as they are.
 */
const LOCATED = /^(ERROR|WARNING):\s*\d+:(\d+|\?):\s*(.*)$/;
const UNLOCATED = /^(ERROR|WARNING):\s*(.*)$/;
/** ANGLE's closing tally, e.g. `ERROR: 2 compilation errors.  No code generated.` */
const SUMMARY = /^(ERROR|WARNING):\s*\d+ compilation (errors?|warnings?)\./;

const EMPTY_LOG_MESSAGE = '컴파일 실패 (드라이버가 로그를 남기지 않음)';

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
      const code = bodyLines[index]?.trim();
      diagnostics.push({ severity, file: shader.files[fileIndex], line, message, ...(code ? { code } : {}) });
    } else {
      diagnostics.push({ severity, ...(passFile ? { file: passFile } : {}), message });
    }
  }

  if (!diagnostics.some((d) => d.severity === 'error')) {
    diagnostics.push({ severity: 'error', ...(passFile ? { file: passFile } : {}), message: EMPTY_LOG_MESSAGE });
  }
  return diagnostics;
}
