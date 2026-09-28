import { describe, expect, it } from 'vitest';
import { wrapMainImage } from '../engine/wrap';
import type { ShaderSource } from '../shader-source';
import { compileDiagnostics } from './compile';

const body = [
  'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
  '  vec3 col = colr * 0.5;',
  '  fragColor = vec4(col, 1.0)',
  '}',
].join('\n');

const main: ShaderSource = {
  source: body,
  lines: [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ],
  files: ['sketches/2026-09-28-hello/main.frag'],
};

/** Line number the compiler reports for body line `n` (1-based) once the engine wraps it. */
const { prefixLines } = wrapMainImage(body);
const wrapped = (n: number) => prefixLines + n;

describe('compileDiagnostics', () => {
  it('maps an ANGLE error on a body line back to the original file and line', () => {
    const log = `ERROR: 0:${wrapped(2)}: 'colr' : undeclared identifier\nERROR: 1 compilation errors.  No code generated.\n`;
    expect(compileDiagnostics(log, main, prefixLines)).toEqual([
      {
        severity: 'error',
        file: 'sketches/2026-09-28-hello/main.frag',
        line: 2,
        message: "'colr' : undeclared identifier",
        code: 'vec3 col = colr * 0.5;',
      },
    ]);
  });

  it('keeps every error in the log, in order, and drops the summary line', () => {
    const log = [
      `ERROR: 0:${wrapped(2)}: 'colr' : undeclared identifier`,
      `ERROR: 0:${wrapped(4)}: '}' : syntax error`,
      'ERROR: 2 compilation errors.  No code generated.',
      '',
    ].join('\n');
    const result = compileDiagnostics(log, main, prefixLines);
    expect(result.map((d) => [d.line, d.message])).toEqual([
      [2, "'colr' : undeclared identifier"],
      [4, "'}' : syntax error"],
    ]);
  });

  it('follows the line table, so expanded lines point at the file they came from', () => {
    const expanded: ShaderSource = {
      source: 'float noise(vec2 p) {\n  return p.x\n}\nvoid mainImage(out vec4 c, in vec2 p) { c = vec4(noise(p)); }',
      lines: [
        [1, 3],
        [1, 4],
        [1, 5],
        [0, 2],
      ],
      files: ['sketches/x/main.frag', 'lib/noise/noise.glsl'],
    };
    const { prefixLines: pre } = wrapMainImage(expanded.source);
    const [d] = compileDiagnostics(`ERROR: 0:${pre + 3}: '}' : syntax error`, expanded, pre);
    expect(d).toMatchObject({ file: 'lib/noise/noise.glsl', line: 5, code: '}' });
  });

  it('reports errors on engine lines (outside the body) against the Pass file without a line', () => {
    const log = `ERROR: 0:${wrapped(6)}: 'mainImage' : no matching overloaded function found`;
    expect(compileDiagnostics(log, main, prefixLines)).toEqual([
      {
        severity: 'error',
        file: 'sketches/2026-09-28-hello/main.frag',
        message: "'mainImage' : no matching overloaded function found",
      },
    ]);
  });

  it('reads warnings as warnings and lines without a location as-is', () => {
    const log = [
      `WARNING: 0:${wrapped(1)}: 'x' : something odd`,
      'ERROR: 0:?: global problem',
      'L0001 Fragment shader output not written',
      '\0',
    ].join('\n');
    expect(compileDiagnostics(log, main, prefixLines)).toEqual([
      {
        severity: 'warning',
        file: 'sketches/2026-09-28-hello/main.frag',
        line: 1,
        message: "'x' : something odd",
        code: 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
      },
      { severity: 'error', file: 'sketches/2026-09-28-hello/main.frag', message: 'global problem' },
      { severity: 'error', file: 'sketches/2026-09-28-hello/main.frag', message: 'L0001 Fragment shader output not written' },
    ]);
  });

  it('never returns an empty list for a failed compile, even with an empty log', () => {
    expect(compileDiagnostics('', main, prefixLines)).toEqual([
      { severity: 'error', file: 'sketches/2026-09-28-hello/main.frag', message: '컴파일 실패 (드라이버가 로그를 남기지 않음)' },
    ]);
  });
});
