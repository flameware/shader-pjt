import { describe, expect, it } from 'vitest';
import { wrapMainImage } from './wrap';

const body = [
  'void mainImage(out vec4 fragColor, in vec2 fragCoord) {',
  '  fragColor = vec4(fragCoord / iResolution.xy, 0.5 + 0.5 * sin(iTime), 1.0);',
  '}',
].join('\n');

describe('wrapMainImage', () => {
  it('puts #version 300 es on the very first line', () => {
    expect(wrapMainImage(body).source.split('\n')[0]).toBe('#version 300 es');
  });

  it('keeps the body lines intact, starting right after `prefixLines` engine lines', () => {
    const { source, prefixLines } = wrapMainImage(body);
    const lines = source.split('\n');
    body.split('\n').forEach((line, i) => expect(lines[prefixLines + i]).toBe(line));
  });

  it('declares the engine uniforms with their Shadertoy names and types before the body', () => {
    const { source, prefixLines } = wrapMainImage(body);
    const prefix = source.split('\n').slice(0, prefixLines).join('\n');
    for (const decl of [
      'uniform vec3 iResolution;',
      'uniform float iTime;',
      'uniform float iTimeDelta;',
      'uniform int iFrame;',
      'uniform vec4 iMouse;',
    ]) {
      expect(prefix).toContain(decl);
    }
    expect(prefix).toMatch(/precision highp float;/);
  });

  it('adds a main() that calls mainImage with gl_FragCoord after the body', () => {
    const { source } = wrapMainImage(body);
    const afterBody = source.slice(source.indexOf(body) + body.length);
    expect(afterBody).toMatch(/void main\(\)\s*\{[^}]*mainImage\(\s*\w+\s*,\s*gl_FragCoord\.xy\s*\)/);
  });

  it('works when the body has no trailing newline or ends with a line comment', () => {
    const { source } = wrapMainImage('void mainImage(out vec4 c, in vec2 p) { c = vec4(1); } // done');
    expect(source).toMatch(/\/\/ done\n/);
  });
});
