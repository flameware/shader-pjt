/**
 * Engine lines put in front of a Pass body. Uniform names and types match Shadertoy.
 * `iChannel0..3` join this list when multi-pass lands (#17).
 */
const PREFIX = [
  '#version 300 es',
  'precision highp float;',
  'precision highp int;',
  'uniform vec3 iResolution;',
  'uniform float iTime;',
  'uniform float iTimeDelta;',
  'uniform int iFrame;',
  'uniform vec4 iMouse;',
  'out vec4 shaderPlaygroundFragColor;',
];

const SUFFIX = [
  'void main() {',
  '  mainImage(shaderPlaygroundFragColor, gl_FragCoord.xy);',
  '}',
];

export interface WrappedShader {
  /** A complete GLSL ES 3.00 fragment shader. */
  source: string;
  /**
   * Number of engine lines before the body. A compiler error on line N of `source` is on
   * line N - prefixLines of the body.
   */
  prefixLines: number;
}

/** Wraps a Shadertoy-style body (only `mainImage(out vec4, in vec2)`) into a full fragment shader. */
export function wrapMainImage(body: string): WrappedShader {
  const bodyWithNewline = body.endsWith('\n') ? body : `${body}\n`;
  return {
    source: `${PREFIX.join('\n')}\n${bodyWithNewline}${SUFFIX.join('\n')}\n`,
    prefixLines: PREFIX.length,
  };
}
