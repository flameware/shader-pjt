import { describe, expect, it } from 'vitest';
import { formatAnnotation, formatNumber, parseAnnotation, type ParamSpec } from './annotation';

const spec = (type: string, text: string): ParamSpec => {
  const result = parseAnnotation(type, text);
  if ('error' in result) throw new Error(result.error);
  return result.spec;
};
const error = (type: string, text: string): string => {
  const result = parseAnnotation(type, text);
  if ('spec' in result) throw new Error(`parsed: ${JSON.stringify(result.spec)}`);
  return result.error;
};

describe('parseAnnotation', () => {
  it('reads a float slider with a range and a default', () => {
    expect(parseAnnotation('float', '0..2 = 1')).toEqual({ spec: { kind: 'float', min: 0, max: 2, default: 1 } });
  });

  it('reads every example of the spec', () => {
    expect(spec('float', '0..1 = 0.2 step 0.01')).toEqual({ kind: 'float', min: 0, max: 1, default: 0.2, step: 0.01 });
    expect(spec('int', '1..20 = 5')).toEqual({ kind: 'int', min: 1, max: 20, default: 5 });
    expect(spec('bool', '= false')).toEqual({ kind: 'bool', default: false });
    expect(spec('vec3', 'color = #ff8040')).toEqual({ kind: 'color', alpha: false, default: '#ff8040' });
    expect(spec('vec4', 'color = #00000080')).toEqual({ kind: 'color', alpha: true, default: '#00000080' });
    expect(spec('vec2', '-1..1 = 0.5, 0.5')).toEqual({ kind: 'vec2', min: -1, max: 1, default: [0.5, 0.5] });
    expect(spec('int', 'circle|square|noise = square')).toEqual({
      kind: 'select',
      options: ['circle', 'square', 'noise'],
      default: 'square',
    });
  });

  it('falls back to the minimum, false, black or the first choice when the default is left out', () => {
    expect(spec('float', '0.5..2')).toMatchObject({ default: 0.5 });
    expect(spec('int', '3..9')).toMatchObject({ default: 3 });
    expect(spec('bool', '')).toEqual({ kind: 'bool', default: false });
    expect(spec('vec3', 'color')).toMatchObject({ default: '#000000' });
    expect(spec('vec4', 'color')).toMatchObject({ default: '#000000ff' });
    expect(spec('vec2', '-1..1')).toMatchObject({ default: [-1, -1] });
    expect(spec('int', 'a|b|c')).toMatchObject({ default: 'a' });
  });

  it('makes a float without a range a number box', () => {
    expect(spec('float', '= 2.5')).toEqual({ kind: 'float', default: 2.5 });
    expect(spec('float', '')).toEqual({ kind: 'float', default: 0 });
  });

  it('tolerates spacing and case differences', () => {
    expect(spec('float', '  -1 .. 1=0 ')).toEqual({ kind: 'float', min: -1, max: 1, default: 0 });
    expect(spec('vec3', 'color=#FF8040')).toMatchObject({ default: '#ff8040' });
    expect(spec('int', 'a | b = b')).toMatchObject({ options: ['a', 'b'], default: 'b' });
  });

  it('rejects plain vec3/vec4 and types a Parameter cannot have', () => {
    expect(error('vec3', '0..1')).toContain('일반 vec3는 지원하지 않습니다');
    expect(error('vec4', '= 1')).toContain('일반 vec4는 지원하지 않습니다');
    expect(error('mat2', '')).toContain('@param을 쓸 수 없는 타입');
    expect(error('sampler2D', '')).toContain('@param을 쓸 수 없는 타입');
  });

  it('rejects annotations it cannot read, saying what is wrong', () => {
    expect(error('float', '0..x = 1')).toContain("최댓값가 숫자가 아닙니다: 'x'");
    expect(error('float', '2..1')).toContain('최솟값이 최댓값보다 작아야');
    expect(error('float', '0..1 = 3')).toContain('범위 0..1 밖');
    expect(error('float', '0..1 =')).toContain('기본값이 없습니다');
    expect(error('float', '0..1 = 0.5 step 0')).toContain('step은 0보다 커야');
    expect(error('float', 'slider')).toContain("범위를 읽을 수 없습니다: 'slider'");
    expect(error('int', '0..1.5')).toContain('정수가 아닙니다');
    expect(error('int', '= 3')).toContain('범위(1..20)나 선택지');
    expect(error('int', 'a|b = c')).toContain("'c'이 선택지에 없습니다");
    expect(error('int', 'a|a')).toContain('선택지 이름이 겹칩니다');
    expect(error('int', 'a|2x')).toContain("선택지 이름이 올바르지 않습니다: '2x'");
    expect(error('bool', '= yes')).toContain('true나 false');
    expect(error('vec3', 'color = #ff804080')).toContain('#rrggbb 형식');
    expect(error('vec4', 'color = #ff8040')).toContain('#rrggbbaa 형식');
    expect(error('vec2', '= 0, 0')).toContain('vec2에는 범위가 필요');
    expect(error('vec2', '0..1 = 0.5')).toContain("'x, y' 형식");
    expect(error('bool', '= true step 1')).toContain('step을 쓸 수 없습니다');
  });

  it('adds an example of the right notation to every error', () => {
    expect(error('vec2', '0..1 = 0.5')).toContain('예: `@param -1..1 = 0.5, 0.5`');
  });
});

describe('formatAnnotation', () => {
  it('writes a value back in the annotation notation', () => {
    expect(formatAnnotation(spec('float', '0..2 = 1'), 1.25)).toBe('0..2 = 1.25');
    expect(formatAnnotation(spec('float', '0..1 = 0.2 step 0.01'), 0.37)).toBe('0..1 = 0.37 step 0.01');
    expect(formatAnnotation(spec('float', '= 1'), 4)).toBe('= 4');
    expect(formatAnnotation(spec('int', '1..20 = 5'), 7)).toBe('1..20 = 7');
    expect(formatAnnotation(spec('bool', '= false'), true)).toBe('= true');
    expect(formatAnnotation(spec('vec3', 'color = #ff8040'), '#102030')).toBe('color = #102030');
    expect(formatAnnotation(spec('vec4', 'color = #00000080'), '#10203040')).toBe('color = #10203040');
    expect(formatAnnotation(spec('vec2', '-1..1 = 0.5, 0.5'), [0.25, -0.75])).toBe('-1..1 = 0.25, -0.75');
    expect(formatAnnotation(spec('int', 'circle|square|noise = square'), 'noise')).toBe('circle|square|noise = noise');
  });

  it('round-trips: the written annotation parses back to the same kind with that value as its default', () => {
    const cases: [string, string, Parameters<typeof formatAnnotation>[1]][] = [
      ['float', '-3..0.5 step 0.25', -1.5],
      ['vec2', '0..10', [2.5, 9]],
      ['int', 'a|b|c', 'c'],
      ['vec4', 'color', '#abcdef12'],
    ];
    for (const [type, text, value] of cases) {
      const original = spec(type, text);
      expect(spec(type, formatAnnotation(original, value))).toEqual({ ...original, default: value });
    }
  });
});

describe('formatNumber', () => {
  it('prints the shortest decimal the GPU reads as the same float', () => {
    expect(formatNumber(0.37000000000000005)).toBe('0.37');
    expect(formatNumber(1)).toBe('1');
    expect(formatNumber(-0.125)).toBe('-0.125');
    const odd = 0.123456789;
    expect(Math.fround(Number(formatNumber(odd)))).toBe(Math.fround(odd));
  });
});
