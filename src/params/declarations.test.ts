import { describe, expect, it } from 'vitest';
import type { ShaderSource } from '../shader-source';
import { findDeclarations } from './declarations';

/** A Pass made of one file, or of `[file, line text]` pairs when lines come from several files. */
function pass(lines: (string | [string, string])[], extra: Partial<ShaderSource> = {}): ShaderSource {
  const files = ['sketches/s/main.frag'];
  const perFileLine = new Map<string, number>();
  const table: [number, number][] = [];
  const text: string[] = [];
  for (const entry of lines) {
    const [file, line] = typeof entry === 'string' ? ['sketches/s/main.frag', entry] : entry;
    if (!files.includes(file)) files.push(file);
    const n = (perFileLine.get(file) ?? 0) + 1;
    perFileLine.set(file, n);
    table.push([files.indexOf(file), n]);
    text.push(line);
  }
  return { source: text.join('\n'), lines: table, files, ...extra };
}

describe('findDeclarations', () => {
  it('finds each annotated uniform, in source order, with where it was declared', () => {
    const result = findDeclarations(
      pass([
        'uniform float speed;   // @param 0..2 = 1',
        'uniform highp vec3 tint; // @param color = #ff8040',
        'void mainImage(out vec4 c, in vec2 p) { c = vec4(tint * speed, 1.0); }',
      ]),
    );
    expect(result).toEqual({
      declarations: [
        { name: 'speed', type: 'float', spec: { kind: 'float', min: 0, max: 2, default: 1 }, file: 'sketches/s/main.frag', line: 1 },
        { name: 'tint', type: 'vec3', spec: { kind: 'color', alpha: false, default: '#ff8040' }, file: 'sketches/s/main.frag', line: 2 },
      ],
      diagnostics: [],
    });
  });

  it('finds declarations in a Sketch file the Pass includes, reporting the original file and line', () => {
    const result = findDeclarations(
      pass([['sketches/s/common.glsl', '// shared'], ['sketches/s/common.glsl', 'uniform int count; // @param 1..20 = 5'], 'void mainImage(out vec4 c, in vec2 p) {}'], {
        includedFrom: [null, [0, 1]],
      }),
    );
    expect(result.declarations).toEqual([
      { name: 'count', type: 'int', spec: { kind: 'int', min: 1, max: 20, default: 5 }, file: 'sketches/s/common.glsl', line: 2 },
    ]);
  });

  it('reports an annotation it cannot read as an error on the original line', () => {
    const { declarations, diagnostics } = findDeclarations(pass(['', 'uniform float speed; // @param 0..2 = 5']));
    expect(declarations).toEqual([]);
    expect(diagnostics).toEqual([
      {
        severity: 'error',
        file: 'sketches/s/main.frag',
        line: 2,
        message: expect.stringContaining("speed: 기본값 5이 범위 0..2 밖입니다"),
        sourceLine: 'uniform float speed; // @param 0..2 = 5',
      },
    ]);
  });

  it('warns about a Sketch uniform without @param, since nothing sets it', () => {
    const { declarations, diagnostics } = findDeclarations(pass(['uniform float grain;', 'uniform sampler2D tex;']));
    expect(declarations).toEqual([]);
    expect(diagnostics.map((d) => [d.severity, d.line, d.message])).toEqual([
      ['warning', 1, "uniform 'grain'에 @param이 없어 GUI에 나오지 않고 값이 항상 0입니다"],
      ['warning', 2, "uniform 'tex'에 @param이 없어 GUI에 나오지 않고 값이 항상 0입니다"],
    ]);
  });

  it('rejects a name the engine reserves (i + capital letter), with or without @param', () => {
    const { declarations, diagnostics } = findDeclarations(pass(['uniform float iSpeed; // @param 0..1', 'uniform float iTime;', 'uniform float ice; // @param 0..1']));
    expect(declarations.map((d) => d.name)).toEqual(['ice']);
    expect(diagnostics.map((d) => [d.severity, d.line, d.message])).toEqual([
      ['error', 1, "'iSpeed'은 엔진 uniform 이름(i + 대문자)과 겹칩니다. 다른 이름을 쓰세요"],
      ['error', 2, "'iTime'은 엔진 uniform 이름(i + 대문자)과 겹칩니다. 다른 이름을 쓰세요"],
    ]);
  });

  it('rejects @param in Library files (lib/ or lygia), with the include chain', () => {
    const { declarations, diagnostics } = findDeclarations(
      pass([['lib/noise/x.glsl', 'uniform float amp; // @param 0..1'], 'void mainImage(out vec4 c, in vec2 p) {}'], { includedFrom: [null, [0, 1]] }),
    );
    expect(declarations).toEqual([]);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        file: 'lib/noise/x.glsl',
        line: 1,
        message: 'Library 파일에는 @param을 둘 수 없습니다. Sketch 파일로 옮기세요',
        includeChain: ['sketches/s/main.frag:1'],
      }),
    ]);
  });

  it('leaves uniforms in Library files alone (lygia declares some behind #ifdef)', () => {
    const result = findDeclarations(
      pass([['node_modules/lygia/x.glsl', 'uniform sampler2D MATERIAL_NORMALMAP;'], ['node_modules/lygia/x.glsl', 'uniform float iLygia;'], 'void mainImage(out vec4 c, in vec2 p) {}'], { includedFrom: [null, [0, 1]] }),
    );
    expect(result).toEqual({ declarations: [], diagnostics: [] });
  });

  it('rejects @param on something that is not a single uniform declaration', () => {
    const { diagnostics } = findDeclarations(pass(['float speed = 1.0; // @param 0..2', 'uniform float a, b; // @param 0..1', 'uniform float arr[2]; // @param 0..1']));
    expect(diagnostics.map((d) => [d.line, d.message])).toEqual([
      [1, '@param은 uniform 선언 한 줄(`uniform float speed; // @param 0..2 = 1`)에만 붙일 수 있습니다'],
      [2, '@param은 uniform 선언 한 줄(`uniform float speed; // @param 0..2 = 1`)에만 붙일 수 있습니다'],
      [3, '@param은 uniform 선언 한 줄(`uniform float speed; // @param 0..2 = 1`)에만 붙일 수 있습니다'],
    ]);
  });

  it('ignores commented-out lines and prose that mentions @param mid-comment', () => {
    const result = findDeclarations(pass(['// uniform float old; // @param 0..1', 'float x; // tweak it with @param later']));
    expect(result).toEqual({ declarations: [], diagnostics: [] });
  });
});
