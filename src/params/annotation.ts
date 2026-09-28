/**
 * The `// @param` annotation on a uniform (#6 decision 2): what a Parameter is, parsed from the
 * text after `@param`, and written back in the same notation (for "현재 값 복사").
 *
 * Values are kept in the same notation the annotation and Capture metadata use: numbers,
 * booleans, color as a hex string, vec2 as `[x, y]`, select as the choice's name.
 */

/** A Parameter's kind and settings. `float` has either both `min`/`max` (slider) or neither (number box). */
export type ParamSpec =
  | { kind: 'float'; min?: number; max?: number; step?: number; default: number }
  | { kind: 'int'; min: number; max: number; step?: number; default: number }
  | { kind: 'bool'; default: boolean }
  | { kind: 'color'; alpha: boolean; default: string }
  | { kind: 'vec2'; min: number; max: number; step?: number; default: [number, number] }
  | { kind: 'select'; options: string[]; default: string };

export type ParamValue = number | boolean | string | [number, number];

export type ParseResult = { spec: ParamSpec } | { error: string };

/** The GLSL types a `@param` may annotate. */
export type ParamGlslType = 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'vec4';

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const INTEGER = /^[-+]?\d+$/;
const RANGE = /^(\S+?)\s*\.\.\s*(\S+)$/;
const STEP = /(^|\s)step\s+(\S+)\s*$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX8 = /^#[0-9a-fA-F]{8}$/;
const OPTION = /^[A-Za-z_][\w-]*$/;

const EXAMPLE: Record<ParamGlslType, string> = {
  float: '`@param 0..1 = 0.5` 또는 `@param = 0.5`',
  int: '`@param 1..20 = 5` 또는 `@param a|b|c = b`',
  bool: '`@param = false`',
  vec2: '`@param -1..1 = 0.5, 0.5`',
  vec3: '`@param color = #ff8040`',
  vec4: '`@param color = #00000080`',
};

class AnnotationError extends Error {}
const fail = (message: string): never => {
  throw new AnnotationError(message);
};

function number(text: string, what: string): number {
  if (!NUMBER.test(text)) fail(`${what}가 숫자가 아닙니다: '${text}'`);
  return Number(text);
}

function integer(text: string, what: string): number {
  if (!INTEGER.test(text)) fail(`${what}가 정수가 아닙니다: '${text}'`);
  return Number(text);
}

function range(head: string, parse: (text: string, what: string) => number): [number, number] {
  const match = RANGE.exec(head);
  if (!match) fail(`범위를 읽을 수 없습니다: '${head}' (예: 0..1)`);
  const min = parse(match![1]!, '최솟값');
  const max = parse(match![2]!, '최댓값');
  if (!(min < max)) fail(`최솟값이 최댓값보다 작아야 합니다: ${head}`);
  return [min, max];
}

function inRange(value: number, min: number, max: number, text: string): void {
  if (value < min || value > max) fail(`기본값 ${text}이 범위 ${formatNumber(min)}..${formatNumber(max)} 밖입니다`);
}

function positiveStep(text: string | undefined, parse: (text: string, what: string) => number): number | undefined {
  if (text === undefined) return undefined;
  const step = parse(text, 'step');
  if (!(step > 0)) fail(`step은 0보다 커야 합니다: ${text}`);
  return step;
}

function parseSpec(type: ParamGlslType, text: string): ParamSpec {
  let rest = text.trim();
  const stepMatch = STEP.exec(rest);
  const stepText = stepMatch?.[2];
  if (stepMatch) rest = rest.slice(0, stepMatch.index).trim();
  const eq = rest.indexOf('=');
  const head = (eq < 0 ? rest : rest.slice(0, eq)).trim();
  const defaultText = eq < 0 ? undefined : rest.slice(eq + 1).trim();
  if (defaultText === '') fail('`=` 뒤에 기본값이 없습니다');
  const noStep = (kind: string) => stepText !== undefined && fail(`${kind}에는 step을 쓸 수 없습니다`);

  switch (type) {
    case 'float': {
      if (head === '') {
        const step = positiveStep(stepText, number);
        const value = defaultText === undefined ? 0 : number(defaultText, '기본값');
        return { kind: 'float', default: value, ...(step !== undefined && { step }) };
      }
      const [min, max] = range(head, number);
      const step = positiveStep(stepText, number);
      const value = defaultText === undefined ? min : number(defaultText, '기본값');
      inRange(value, min, max, defaultText ?? '');
      return { kind: 'float', min, max, default: value, ...(step !== undefined && { step }) };
    }
    case 'int': {
      if (head.includes('|')) {
        noStep('선택지(select)');
        const options = head.split('|').map((o) => o.trim());
        for (const option of options) if (!OPTION.test(option)) fail(`선택지 이름이 올바르지 않습니다: '${option}'`);
        if (new Set(options).size !== options.length) fail(`선택지 이름이 겹칩니다: ${head}`);
        const value = defaultText ?? options[0]!;
        if (!options.includes(value)) fail(`기본값 '${value}'이 선택지에 없습니다`);
        return { kind: 'select', options, default: value };
      }
      if (head === '') fail('int에는 범위(1..20)나 선택지(a|b|c)가 필요합니다');
      const [min, max] = range(head, integer);
      const step = positiveStep(stepText, integer);
      const value = defaultText === undefined ? min : integer(defaultText, '기본값');
      inRange(value, min, max, defaultText ?? '');
      return { kind: 'int', min, max, default: value, ...(step !== undefined && { step }) };
    }
    case 'bool': {
      noStep('bool');
      if (head !== '') fail(`bool에는 범위나 선택지를 쓸 수 없습니다: '${head}'`);
      if (defaultText !== undefined && defaultText !== 'true' && defaultText !== 'false') {
        fail(`bool의 기본값은 true나 false입니다: '${defaultText}'`);
      }
      return { kind: 'bool', default: defaultText === 'true' };
    }
    case 'vec3':
    case 'vec4': {
      if (head !== 'color') fail(`일반 ${type}는 지원하지 않습니다. 색이면 \`@param color\`를 쓰세요`);
      noStep('color');
      const alpha = type === 'vec4';
      const pattern = alpha ? HEX8 : HEX6;
      if (defaultText !== undefined && !pattern.test(defaultText)) {
        fail(`${type} color의 기본값은 ${alpha ? '#rrggbbaa' : '#rrggbb'} 형식입니다: '${defaultText}'`);
      }
      const black = alpha ? '#000000ff' : '#000000';
      return { kind: 'color', alpha, default: defaultText?.toLowerCase() ?? black };
    }
    case 'vec2': {
      if (head === '') fail('vec2에는 범위가 필요합니다 (예: -1..1)');
      const [min, max] = range(head, number);
      const step = positiveStep(stepText, number);
      let value: [number, number] = [min, min];
      if (defaultText !== undefined) {
        const parts = defaultText.split(',').map((p) => p.trim());
        if (parts.length !== 2) fail(`vec2의 기본값은 'x, y' 형식입니다: '${defaultText}'`);
        value = [number(parts[0]!, '기본값 x'), number(parts[1]!, '기본값 y')];
        for (const v of value) inRange(v, min, max, defaultText);
      }
      return { kind: 'vec2', min, max, default: value, ...(step !== undefined && { step }) };
    }
  }
}

/**
 * Parses the text after `@param` for a uniform of GLSL type `type` (e.g. `'0..2 = 1'`).
 * A `float` without a range is a number box; an omitted default is the minimum (float/int, and
 * `min, min` for vec2), 0 for a float without a range, false, black, or the first choice.
 */
export function parseAnnotation(type: string, text: string): ParseResult {
  if (!(type in EXAMPLE)) return { error: `@param을 쓸 수 없는 타입입니다: ${type} (float, int, bool, vec2, vec3/vec4 color만)` };
  try {
    return { spec: parseSpec(type as ParamGlslType, text) };
  } catch (error) {
    if (!(error instanceof AnnotationError)) throw error;
    return { error: `${error.message} — 예: ${EXAMPLE[type as ParamGlslType]}` };
  }
}

/** A value in annotation notation: `1.25`, `true`, `#ff8040`, `0.5, 0.5`, `square`. */
export function formatValue(value: ParamValue): string {
  if (Array.isArray(value)) return value.map(formatNumber).join(', ');
  return typeof value === 'number' ? formatNumber(value) : String(value);
}

/** The text after `@param` that declares `spec` with `value` as its default. */
export function formatAnnotation(spec: ParamSpec, value: ParamValue): string {
  const withDefault = (head: string) => `${head}${head && ' '}= ${formatValue(value)}`;
  const step = 'step' in spec && spec.step !== undefined ? ` step ${formatNumber(spec.step)}` : '';
  switch (spec.kind) {
    case 'float':
    case 'int':
    case 'vec2': {
      const range = spec.min === undefined || spec.max === undefined ? '' : `${formatNumber(spec.min)}..${formatNumber(spec.max)}`;
      return withDefault(range) + step;
    }
    case 'bool':
      return withDefault('');
    case 'color':
      return withDefault('color');
    case 'select':
      return withDefault(spec.options.join('|'));
  }
}

/**
 * The shortest decimal that is the same 32-bit float as `value` (what the GPU sees), so a
 * copied annotation pasted back gives the same value without printing float noise.
 */
export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const target = Math.fround(value);
  for (let digits = 1; digits <= 9; digits++) {
    const text = String(Number(value.toPrecision(digits)));
    if (Math.fround(Number(text)) === target) return text;
  }
  return String(value);
}
