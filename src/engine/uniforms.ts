import { MAX_CHANNELS } from '../sketch/graph';

/**
 * The one table of engine uniforms: `wrapMainImage` declares them in front of every Pass body
 * and the renderer looks them up by the same names. Names and types match Shadertoy.
 */
const FRAME_UNIFORMS = {
  iResolution: 'vec3',
  iTime: 'float',
  iTimeDelta: 'float',
  iFrame: 'int',
  iMouse: 'vec4',
} as const;

const CHANNEL_NAMES = Array.from({ length: MAX_CHANNELS }, (_, i) => `iChannel${i}`);

/** Uniform locations of one program; `null` where the compiler dropped an unused uniform. */
export type UniformLocations = Record<keyof typeof FRAME_UNIFORMS, WebGLUniformLocation | null> & {
  iChannelResolution: WebGLUniformLocation | null;
  /** `iChannels[i]` is `iChannel<i>`. */
  iChannels: (WebGLUniformLocation | null)[];
};

/** GLSL declarations of every engine uniform, one per line. */
export function uniformDeclarations(): string[] {
  return [
    ...Object.entries(FRAME_UNIFORMS).map(([name, type]) => `uniform ${type} ${name};`),
    `uniform vec3 iChannelResolution[${MAX_CHANNELS}];`,
    ...CHANNEL_NAMES.map((name) => `uniform sampler2D ${name};`),
  ];
}

/** Looks up every engine uniform in `program`. */
export function uniformLocations(gl: WebGL2RenderingContext, program: WebGLProgram): UniformLocations {
  const at = (name: string) => gl.getUniformLocation(program, name);
  const frame = Object.fromEntries(Object.keys(FRAME_UNIFORMS).map((name) => [name, at(name)]));
  return {
    ...(frame as Record<keyof typeof FRAME_UNIFORMS, WebGLUniformLocation | null>),
    iChannelResolution: at('iChannelResolution'),
    iChannels: CHANNEL_NAMES.map(at),
  };
}
