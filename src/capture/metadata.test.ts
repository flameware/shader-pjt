import { describe, expect, it } from 'vitest';
import type { Parameter } from '../params/values';
import { captureMetadata, parameterSnapshot, withGit } from './metadata';

const parameters: Parameter[] = [
  { name: 'speed', type: 'float', spec: { kind: 'float', min: 0, max: 4, default: 1 } },
  { name: 'count', type: 'int', spec: { kind: 'int', min: 1, max: 9, default: 3 } },
  { name: 'glow', type: 'bool', spec: { kind: 'bool', default: false } },
  { name: 'tint', type: 'vec3', spec: { kind: 'color', alpha: false, default: '#000000' } },
  { name: 'fog', type: 'vec4', spec: { kind: 'color', alpha: true, default: '#00000000' } },
  { name: 'center', type: 'vec2', spec: { kind: 'vec2', min: 0, max: 1, default: [0.5, 0.5] } },
  { name: 'mode', type: 'int', spec: { kind: 'select', options: ['circle', 'square'], default: 'circle' } },
];

describe('parameterSnapshot', () => {
  it('writes the values a frame was drawn with in "현재 값 복사" notation', () => {
    const uniforms = [
      { name: 'speed', type: 'float' as const, data: [1.2] },
      { name: 'count', type: 'int' as const, data: [7] },
      { name: 'glow', type: 'bool' as const, data: [1] },
      { name: 'tint', type: 'vec3' as const, data: [1, 128 / 255, 64 / 255] },
      { name: 'fog', type: 'vec4' as const, data: [0, 0, 1, 128 / 255] },
      { name: 'center', type: 'vec2' as const, data: [0.25, 0.75] },
      { name: 'mode', type: 'int' as const, data: [1] },
    ];
    expect(parameterSnapshot(parameters, uniforms)).toEqual({
      speed: 1.2,
      count: 7,
      glow: true,
      tint: '#ff8040',
      fog: '#0000ff80',
      center: [0.25, 0.75],
      mode: 'square',
    });
  });

  it('skips uniforms that no longer have a declaration, or whose type changed since', () => {
    expect(parameterSnapshot(parameters.slice(0, 1), [{ name: 'gone', type: 'float', data: [3] }])).toEqual({});
    expect(parameterSnapshot(parameters, [{ name: 'speed', type: 'int', data: [3] }])).toEqual({});
  });

  it('keeps a false bool', () => {
    expect(parameterSnapshot(parameters, [{ name: 'glow', type: 'bool', data: [0] }])).toEqual({ glow: false });
  });
});

describe('captureMetadata', () => {
  it('lays out the #8 decision 12 fields, in order, from the frame the image was made with', () => {
    const meta = captureMetadata({
      sketch: '2026-09-28-flow',
      kind: 'screen',
      size: [1600, 1000],
      output: 'window',
      renderScale: 'fit',
      feedback: true,
      frame: { time: 12.345, frame: 740, mouse: [10, 20, -10, -20], parameters: [{ name: 'speed', type: 'float', data: [2] }] },
      parameters,
      capturedAt: '2026-09-28T21:30:45+09:00',
    });
    expect(JSON.stringify(meta)).toBe(
      JSON.stringify({
        v: 1,
        sketch: '2026-09-28-flow',
        kind: 'screen',
        size: [1600, 1000],
        output: 'window',
        renderScale: 'fit',
        feedback: true,
        iTime: 12.345,
        iFrame: 740,
        iMouse: [10, 20, -10, -20],
        params: { speed: 2 },
        capturedAt: '2026-09-28T21:30:45+09:00',
      }),
    );
  });
});

describe('withGit', () => {
  it('puts git just before capturedAt', () => {
    const meta = captureMetadata({
      sketch: 's',
      kind: 'output',
      size: [2160, 2700],
      output: '4:5',
      renderScale: 'full',
      feedback: false,
      frame: { time: 0, frame: 0, mouse: [0, 0, 0, 0] },
      parameters: [],
      capturedAt: '2026-09-28T21:30:45+09:00',
    });
    const keys = Object.keys(withGit(meta, { commit: '4af66b6', dirty: true }));
    expect(keys.slice(-2)).toEqual(['git', 'capturedAt']);
    expect(withGit(meta, { commit: '4af66b6', dirty: true }).git).toEqual({ commit: '4af66b6', dirty: true });
  });
});
