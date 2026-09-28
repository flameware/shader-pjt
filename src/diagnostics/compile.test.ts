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
        sourceLine: 'vec3 col = colr * 0.5;',
      },
    ]);
  });

  it('maps an error inside an included file to that file and line, with the include chain that pulled it in', () => {
    const included: ShaderSource = {
      source: ['float hash(float x) { return fract(x * PI); }', 'void mainImage(out vec4 c, in vec2 p) { c = vec4(0.0); }'].join('\n'),
      lines: [
        [2, 2],
        [0, 3],
      ],
      files: ['sketches/x/main.frag', 'lib/noise/valueNoise.glsl', 'lib/math/hash21.glsl'],
      includedFrom: [null, [0, 2], [1, 1]],
    };
    const log = `ERROR: 0:${wrapped(1)}: 'PI' : undeclared identifier\n`;
    expect(compileDiagnostics(log, included, prefixLines)).toEqual([
      {
        severity: 'error',
        file: 'lib/math/hash21.glsl',
        line: 2,
        message: "'PI' : undeclared identifier",
        sourceLine: 'float hash(float x) { return fract(x * PI); }',
        includeChain: ['sketches/x/main.frag:2', 'lib/noise/valueNoise.glsl:1'],
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
    expect(d).toMatchObject({ file: 'lib/noise/noise.glsl', line: 5, sourceLine: '}' });
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
        sourceLine: 'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
      },
      { severity: 'error', file: 'sketches/2026-09-28-hello/main.frag', message: 'global problem' },
      { severity: 'error', file: 'sketches/2026-09-28-hello/main.frag', message: 'L0001 Fragment shader output not written' },
    ]);
  });

  it('always includes an error for a failed compile, even when the log has none', () => {
    const failed = { severity: 'error', file: 'sketches/2026-09-28-hello/main.frag', message: '컴파일 실패 (로그에 에러 줄이 없음)' };
    expect(compileDiagnostics('', main, prefixLines)).toEqual([failed]);
    expect(compileDiagnostics('WARNING: 0:?: odd', main, prefixLines)).toEqual([
      { severity: 'warning', file: 'sketches/2026-09-28-hello/main.frag', message: 'odd' },
      failed,
    ]);
  });
});
