import { describe, expect, it } from 'vitest';
import { type ParamGlslType, type ParamSpec, parseAnnotation } from './annotation';
import { type Parameter, createParameterValues, memoryStorage } from './values';

const param = (name: string, type: ParamGlslType, annotation: string): Parameter => {
  const result = parseAnnotation(type, annotation);
  if ('error' in result) throw new Error(result.error);
  return { name, type, spec: result.spec };
};

/** Opens the Sketch's values the way a page load does: a fresh store over the same storage. */
function reload(storage: Storage, parameters: Parameter[], sketch = 'sk') {
  const values = createParameterValues(sketch, storage);
  values.setParameters(parameters, { complete: true });
  return values;
}

describe('Parameter values', () => {
  it('start at the declared defaults', () => {
    const values = reload(memoryStorage(), [param('speed', 'float', '0..2 = 1'), param('mode', 'int', 'a|b|c = b')]);
    expect(values.snapshot()).toEqual({ speed: 1, mode: 'b' });
  });

  it('survive a reload, per Sketch', () => {
    const storage = memoryStorage();
    const speed = param('speed', 'float', '0..2 = 1');
    reload(storage, [speed]).set('speed', 1.5);
    expect(reload(storage, [speed]).get('speed')).toBe(1.5);
    expect(reload(storage, [speed], 'other').get('speed')).toBe(1);
  });

  it('are thrown away when the type or the default changes', () => {
    const storage = memoryStorage();
    reload(storage, [param('a', 'float', '0..2 = 1'), param('b', 'float', '0..2 = 1')]).set('a', 1.5);
    const values = reload(storage, [param('a', 'int', '0..2 = 1'), param('b', 'float', '0..2 = 0.5')]);
    expect(values.snapshot()).toEqual({ a: 1, b: 0.5 });
    reload(storage, [param('a', 'int', '0..2 = 1')]).set('a', 2);
    expect(reload(storage, [param('a', 'int', 'x|y = x')]).get('a')).toBe('x');
  });

  it('are clamped into a new range when only the range changes', () => {
    const storage = memoryStorage();
    reload(storage, [param('f', 'float', '0..2 = 1'), param('i', 'int', '0..10 = 1'), param('p', 'vec2', '-1..1 = 0, 0')]);
    const before = reload(storage, [param('f', 'float', '0..2 = 1'), param('i', 'int', '0..10 = 1'), param('p', 'vec2', '-1..1 = 0, 0')]);
    before.set('f', 1.8);
    before.set('i', 9);
    before.set('p', [-0.9, 0.9]);
    const after = reload(storage, [param('f', 'float', '0..1.5 = 1'), param('i', 'int', '1..5 = 1'), param('p', 'vec2', '-0.5..2 = 0, 0')]);
    expect(after.snapshot()).toEqual({ f: 1.5, i: 5, p: [-0.5, 0.9] });
  });

  it('follow a select choice by name when the choices change, else fall back to the default', () => {
    const storage = memoryStorage();
    reload(storage, [param('m', 'int', 'a|b|c = a'), param('n', 'int', 'a|b|c = a')]).set('m', 'c');
    reload(storage, [param('m', 'int', 'a|b|c = a'), param('n', 'int', 'a|b|c = a')]).set('n', 'b');
    const values = reload(storage, [param('m', 'int', 'a|x|c = a'), param('n', 'int', 'a|x|c = a')]);
    expect(values.snapshot()).toEqual({ m: 'c', n: 'a' });
  });

  it('are deleted when the declaration disappears, but only once every Pass is known', () => {
    const storage = memoryStorage();
    const speed = param('speed', 'float', '0..2 = 1');
    reload(storage, [speed]).set('speed', 2);
    // A Pass that failed to build doesn't count as "gone": its values stay stored.
    createParameterValues('sk', storage).setParameters([], { complete: false });
    expect(reload(storage, [speed]).get('speed')).toBe(2);
    reload(storage, []);
    expect(reload(storage, [speed]).get('speed')).toBe(1);
  });

  it('keep the other values across a hot swap', () => {
    const values = reload(memoryStorage(), [param('a', 'float', '0..1'), param('b', 'float', '0..1')]);
    values.set('a', 0.3);
    values.set('b', 0.7);
    values.setParameters([param('a', 'float', '0..1'), param('b', 'float', '0..1 = 0.1'), param('c', 'bool', '= true')], { complete: true });
    expect(values.snapshot()).toEqual({ a: 0.3, b: 0.1, c: true });
  });

  it('ignore stored values that are not the right shape', () => {
    const storage = memoryStorage();
    const spec: ParamSpec = { kind: 'vec2', min: 0, max: 1, default: [0, 0] };
    storage.setItem('shader-playground:param:sk:p', JSON.stringify({ spec, value: 'oops' }));
    storage.setItem('shader-playground:param:sk:q', '{not json');
    const values = reload(storage, [param('p', 'vec2', '0..1'), param('q', 'bool', '')]);
    expect(values.snapshot()).toEqual({ p: [0, 0], q: false });
  });

  it('go back to the defaults on reset', () => {
    const values = reload(memoryStorage(), [param('a', 'float', '0..1 = 0.2'), param('c', 'vec3', 'color = #ff8040')]);
    values.set('a', 0.9);
    values.set('c', '#000000');
    values.resetAll();
    expect(values.snapshot()).toEqual({ a: 0.2, c: '#ff8040' });
  });

  it('copy as uniform lines that declare the current values as defaults', () => {
    const values = reload(memoryStorage(), [
      param('speed', 'float', '0..2 = 1'),
      param('tint', 'vec3', 'color = #ff8040'),
      param('center', 'vec2', '-1..1 = 0.5, 0.5'),
      param('mode', 'int', 'circle|square|noise = square'),
    ]);
    values.set('speed', 0.37000000000000005);
    values.set('mode', 'noise');
    expect(values.copyText()).toBe(
      [
        'uniform float speed;  // @param 0..2 = 0.37',
        'uniform vec3  tint;   // @param color = #ff8040',
        'uniform vec2  center; // @param -1..1 = 0.5, 0.5',
        'uniform int   mode;   // @param circle|square|noise = noise',
        '',
      ].join('\n'),
    );
  });

  it('pasting the copied text back gives the same values', () => {
    const storage = memoryStorage();
    const before = [param('g', 'float', '0..1 = 0.2 step 0.01'), param('bg', 'vec4', 'color = #00000080'), param('on', 'bool', '')];
    const values = reload(storage, before);
    values.set('g', 0.43);
    values.set('bg', '#11223344');
    values.set('on', true);
    const pasted = values.copyText().trim().split('\n').map((line) => {
      const [, type, name, annotation] = /^uniform (\w+)\s+(\w+);\s+\/\/ @param(.*)$/.exec(line)!;
      return param(name!, type as ParamGlslType, annotation!);
    });
    expect(reload(storage, pasted).snapshot()).toEqual({ g: 0.43, bg: '#11223344', on: true });
  });

  it('become uniform data for the GPU: color as 0..1 floats, select as its index, bool as 0/1', () => {
    const values = reload(memoryStorage(), [
      param('speed', 'float', '0..2 = 1'),
      param('count', 'int', '1..20 = 5'),
      param('on', 'bool', '= true'),
      param('tint', 'vec3', 'color = #ff0033'),
      param('bg', 'vec4', 'color = #00000080'),
      param('p', 'vec2', '-1..1 = 0.5, -0.5'),
      param('mode', 'int', 'a|b|c = c'),
    ]);
    expect(values.uniforms()).toEqual([
      { name: 'speed', type: 'float', data: [1] },
      { name: 'count', type: 'int', data: [5] },
      { name: 'on', type: 'bool', data: [1] },
      { name: 'tint', type: 'vec3', data: [1, 0, 0.2] },
      { name: 'bg', type: 'vec4', data: [0, 0, 0, 128 / 255] },
      { name: 'p', type: 'vec2', data: [0.5, -0.5] },
      { name: 'mode', type: 'int', data: [2] },
    ]);
  });

  it('tell subscribers whether the list itself changed', () => {
    const values = createParameterValues('sk', memoryStorage());
    const seen: boolean[] = [];
    values.subscribe(({ listChanged }) => seen.push(listChanged));
    const list = [param('a', 'float', '0..1')];
    values.setParameters(list, { complete: true });
    values.setParameters([param('a', 'float', '0..1')], { complete: true });
    values.set('a', 0.5);
    values.setParameters([param('a', 'float', '0..2')], { complete: true });
    expect(seen).toEqual([true, false, false, true]);
  });

  it('keep working when storage throws (private mode, quota)', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
      key: () => null,
      length: 0,
      clear: () => {},
    } as Storage;
    const values = reload(broken, [param('a', 'float', '0..1 = 0.5')]);
    values.set('a', 0.25);
    expect(values.get('a')).toBe(0.25);
  });
});
