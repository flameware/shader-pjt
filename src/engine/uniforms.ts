import type { ParameterUniform } from '../params/values';
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

/**
 * Names the engine reserves: `i` followed by a capital letter (`iTime`, `iChannel0`, and any
 * added later). A Sketch uniform with such a name is an error (#6 decision 4).
 */
export function isEngineUniformName(name: string): boolean {
  return /^i[A-Z]/.test(name);
}

/** A uniform the linker kept, with its GL type (`gl.FLOAT`, `gl.FLOAT_VEC3`, ...). */
export interface ActiveUniform {
  location: WebGLUniformLocation;
  type: GLenum;
}

/**
 * The Sketch uniforms (Parameters) `program` actually uses, by name. Engine uniforms are left out;
 * they are looked up by `uniformLocations`.
 */
export function parameterUniforms(gl: WebGL2RenderingContext, program: WebGLProgram): Map<string, ActiveUniform> {
  const found = new Map<string, ActiveUniform>();
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info || isEngineUniformName(info.name)) continue;
    const location = gl.getUniformLocation(program, info.name);
    if (location) found.set(info.name, { location, type: info.type });
  }
  return found;
}

/**
 * Uploads each Parameter the program uses. A Parameter whose type differs from the program's
 * uniform (another Pass's version declared it differently and this one still runs) is skipped,
 * so the uniform keeps its old value instead of raising a GL error every frame.
 */
export function setParameterUniforms(
  gl: WebGL2RenderingContext,
  active: ReadonlyMap<string, ActiveUniform>,
  parameters: readonly ParameterUniform[],
): void {
  for (const { name, type, data } of parameters) {
    const uniform = active.get(name);
    if (!uniform) continue;
    const { location } = uniform;
    if (type === 'float' && uniform.type === gl.FLOAT) gl.uniform1f(location, data[0]!);
    else if (type === 'int' && uniform.type === gl.INT) gl.uniform1i(location, data[0]!);
    else if (type === 'bool' && uniform.type === gl.BOOL) gl.uniform1i(location, data[0]!);
    else if (type === 'vec2' && uniform.type === gl.FLOAT_VEC2) gl.uniform2fv(location, data);
    else if (type === 'vec3' && uniform.type === gl.FLOAT_VEC3) gl.uniform3fv(location, data);
    else if (type === 'vec4' && uniform.type === gl.FLOAT_VEC4) gl.uniform4fv(location, data);
  }
}
