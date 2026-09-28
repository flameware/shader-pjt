import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../diagnostics/diagnostic';
import type { ShaderSource } from '../shader-source';
import type { Declaration } from './declarations';
import { type CompileOutcome, createPassPipeline } from './pipeline';

const FILES = { main: 'sketches/s/main.frag', blur: 'sketches/s/blur.frag' };

function shader(pass: keyof typeof FILES, lines: string[], extra: Partial<ShaderSource> = {}): ShaderSource {
  return { source: lines.join('\n'), lines: lines.map((_, i) => [0, i + 1]), files: [FILES[pass]], ...extra };
}

function setup(compileResults: Partial<Record<string, CompileOutcome>> = {}) {
  const board = new Map<string, Diagnostic[]>();
  const compiled: [string, string][] = [];
  const published: { names: string[]; complete: boolean }[] = [];
  const pipeline = createPassPipeline({
    passFiles: FILES,
    order: ['main', 'blur'],
    compile(pass, source) {
      compiled.push([pass, source.source]);
      return compileResults[source.source] ?? { ok: true };
    },
    report: (key, diagnostics) => (diagnostics.length ? board.set(key, [...diagnostics]) : board.delete(key)),
    onParameters: (parameters: readonly Declaration[], { complete }) => published.push({ names: parameters.map((p) => p.name), complete }),
  });
  const messages = () => Object.fromEntries([...board].map(([key, list]) => [key, list.map((d) => `${d.severity}: ${d.message}`)]));
  return { pipeline, compiled, published, messages, last: () => published.at(-1) };
}

const main1 = shader('main', ['uniform float speed; // @param 0..2 = 1', 'void mainImage(out vec4 c, in vec2 p) {}']);
const blur1 = shader('blur', ['uniform float radius; // @param 0..8 = 2', 'uniform float speed; // @param 0..2 = 1']);

describe('createPassPipeline', () => {
  it('compiles every clean Pass and publishes the Sketch Parameters, main first', () => {
    const { pipeline, compiled, last, messages } = setup();
    pipeline.update([
      ['blur', blur1],
      ['main', main1],
    ]);
    expect(compiled.map(([pass]) => pass).sort()).toEqual(['blur', 'main']);
    expect(last()).toEqual({ names: ['speed', 'radius'], complete: true });
    expect(messages()).toEqual({});
  });

  it('shows warnings but still compiles', () => {
    const { pipeline, compiled, messages } = setup();
    pipeline.update([['main', shader('main', ['uniform float grain;'])]]);
    expect(compiled).toHaveLength(1);
    expect(messages()).toEqual({ 'param:sketches/s/main.frag': ["warning: uniform 'grain'에 @param이 없어 GUI에 나오지 않고 값이 항상 0입니다"] });
  });

  it('keeps the last good version (program and Parameters) when a declaration is wrong, then takes the fix', () => {
    const { pipeline, compiled, last, messages } = setup();
    pipeline.update([
      ['main', main1],
      ['blur', shader('blur', ['// no parameters'])],
    ]);
    pipeline.update([['main', shader('main', ['uniform float speed; // @param 0..2 = 9', 'uniform float extra; // @param 0..1'])]]);
    expect(compiled).toHaveLength(2);
    expect(last()).toEqual({ names: ['speed'], complete: false });
    expect(Object.keys(messages())).toEqual(['param:sketches/s/main.frag']);

    pipeline.update([['main', shader('main', ['uniform float speed; // @param 0..2 = 1', 'uniform float extra; // @param 0..1'])]]);
    expect(compiled).toHaveLength(3);
    expect(last()).toEqual({ names: ['speed', 'extra'], complete: true });
    expect(messages()).toEqual({});
  });

  it('blocks a Pass whose includes did not resolve without checking its incomplete source', () => {
    const { pipeline, compiled, messages } = setup();
    const resolveErrors: Diagnostic[] = [{ severity: 'error', message: '파일 없음' }];
    pipeline.update([['main', shader('main', ['uniform float grain;'], { resolveErrors })]]);
    expect(compiled).toEqual([]);
    expect(messages()).toEqual({ 'include:sketches/s/main.frag': ['error: 파일 없음'] });
  });

  it('blocks both sides of a Parameter conflict until one is fixed, then builds the waiting one too', () => {
    const { pipeline, compiled, last, messages } = setup();
    pipeline.update([
      ['main', main1],
      ['blur', blur1],
    ]);
    const blur2 = shader('blur', ['uniform int speed; // @param 0..4 = 1']);
    pipeline.update([['blur', blur2]]);
    expect(compiled).toHaveLength(2);
    expect(Object.keys(messages()).sort()).toEqual(['param:sketches/s/blur.frag', 'param:sketches/s/main.frag']);
    expect(last()?.complete).toBe(false);

    const main2 = shader('main', ['uniform int speed; // @param 0..4 = 1']);
    pipeline.update([['main', main2]]);
    expect(compiled.slice(2).map(([pass]) => pass).sort()).toEqual(['blur', 'main']);
    expect(messages()).toEqual({});
    expect(last()).toEqual({ names: ['speed'], complete: true });
  });

  it('reports a compile failure and keeps the last compiled Parameters; does not retry the same source', () => {
    const broken = ['uniform float speed; // @param 0..2 = 1', 'uniform float more; // @param 0..1', 'oops'].join('\n');
    const { pipeline, compiled, last, messages } = setup({ [broken]: { ok: false, diagnostics: [{ severity: 'error', message: 'syntax error' }] } });
    pipeline.update([['main', main1]]);
    pipeline.update([['main', shader('main', broken.split('\n'))]]);
    expect(messages()).toEqual({ 'compile:sketches/s/main.frag': ['error: syntax error'] });
    expect(last()).toEqual({ names: ['speed'], complete: false });
    pipeline.update([['blur', shader('blur', ['// no parameters'])]]);
    expect(compiled.filter(([pass]) => pass === 'main')).toHaveLength(2);
    expect(messages()).toEqual({ 'compile:sketches/s/main.frag': ['error: syntax error'] });
  });

  it('is incomplete until every Pass has been built', () => {
    const { pipeline, last } = setup();
    pipeline.update([['main', main1]]);
    expect(last()).toEqual({ names: ['speed'], complete: false });
  });
});
