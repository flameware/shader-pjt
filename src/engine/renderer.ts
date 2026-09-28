import { compileProgram, drawFullscreen } from '../gl/program';
import { type Target, createBlankTexture, createTarget, deleteTarget, resampleTarget } from '../gl/target';
import type { ShaderSource } from '../shader-source';
import { MAX_CHANNELS, type PassGraph, type PassNode } from '../sketch/graph';
import { type Slots, bufferSize, createSlots } from './buffers';
import type { FrameTime } from './clock';
import type { ParameterUniform } from '../params/values';
import { type ActiveUniform, type UniformLocations, parameterUniforms, setParameterUniforms, uniformLocations } from './uniforms';
import { wrapMainImage } from './wrap';

export interface FrameInputs extends FrameTime {
  /** The render size (working resolution) in device pixels: the canvas size, and `iResolution` of `main`. */
  width: number;
  height: number;
  mouse: readonly [number, number, number, number];
  /** Current Parameter values, shared by every Pass that declares them. */
  parameters?: readonly ParameterUniform[];
}

export type SwapResult = { ok: true } | { ok: false; log: string; prefixLines: number };

interface PassProgram {
  program: WebGLProgram;
  uniforms: UniformLocations;
  parameters: Map<string, ActiveUniform>;
}

/** A Pass's output: one target, or two when it has Feedback. */
interface PassBuffer {
  node: PassNode;
  slots: Slots;
  targets: Target[];
}

/**
 * Shows the Main pass's float Feedback buffer on the canvas, clamped to 0..1 (#5). The buffer is
 * render-sized like the canvas, so it is read texel for texel.
 */
const PRESENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D source;
out vec4 color;
void main() {
  color = clamp(texelFetch(source, ivec2(gl_FragCoord.xy), 0), 0.0, 1.0);
}
`;

/**
 * Runs a Sketch's pass graph: each running Pass draws into its buffer in order, and `main` draws
 * to the canvas (through a float buffer when something reads `prev('main')`).
 *
 * `setShader` swaps a Pass's program only when the new source compiles; on failure the previous
 * program keeps running. Time and frame count live outside the renderer, and a swap never
 * touches the buffers, so hot swaps keep time and Feedback.
 */
export interface Renderer {
  setShader(pass: string, shader: ShaderSource): SwapResult;
  /**
   * Sets the Passes to run (`null`: run nothing). Buffers start cleared, so this is a reset of
   * Feedback; programs of Passes the graph doesn't have are dropped.
   */
  setGraph(graph: PassGraph | null): void;
  /** True when there is a graph and every Pass it runs has compiled; until then `draw` leaves the canvas as is. */
  isRunning(): boolean;
  /**
   * Empties every buffer, so Feedback starts over (part of the engine's reset). They are
   * reallocated, zero-filled, at the next `draw`'s size: this is also how a new Output size or
   * render scale gets fresh buffers (ADR-0001).
   */
  clearBuffers(): void;
  /**
   * Runs the graph at `frame.width × frame.height`. When that size differs from the last draw
   * (a window resize under `fit`), each buffer is resampled into its new size, so Feedback
   * carries on instead of starting over (#8 decision 4).
   */
  draw(frame: FrameInputs): void;
}

export function createRenderer(gl: WebGL2RenderingContext): Renderer {
  // The fullscreen triangle needs no attributes, but a bound VAO keeps every driver happy.
  gl.bindVertexArray(gl.createVertexArray());
  const blank = createBlankTexture(gl);
  const present = compileProgram(gl, PRESENT_SHADER);
  if (!present.ok) throw new Error(`present shader failed to compile:\n${present.log}`);

  const programs = new Map<string, PassProgram>();
  let graph: PassGraph | null = null;
  let buffers = new Map<string, PassBuffer>();

  const freeBuffers = () => {
    for (const buffer of buffers.values()) for (const target of buffer.targets) deleteTarget(gl, target);
    buffers = new Map();
  };

  /**
   * Gives a buffer its size for this render size: allocated (zero-filled) when it has none,
   * resampled from its old contents when the size changed, untouched otherwise.
   */
  const fitBuffer = (buffer: PassBuffer, renderWidth: number, renderHeight: number) => {
    const [width, height] = bufferSize(buffer.node.buffer.size, renderWidth, renderHeight);
    const [first] = buffer.targets;
    if (first && first.width === width && first.height === height) return;
    const count = buffer.node.feedback ? 2 : 1;
    buffer.targets =
      buffer.targets.length === count
        ? buffer.targets.map((target) => resampleTarget(gl, target, buffer.node.buffer, width, height))
        : Array.from({ length: count }, () => createTarget(gl, buffer.node.buffer, width, height));
  };

  const bindChannels = (node: PassNode, uniforms: UniformLocations, passBuffers: Map<string, PassBuffer>) => {
    const resolutions = new Float32Array(3 * MAX_CHANNELS);
    // Every unit is rebound each Pass, so a texture left bound from an earlier Pass can never be
    // this Pass's own draw target (a feedback loop WebGL refuses to draw).
    for (let unit = 0; unit < MAX_CHANNELS; unit++) {
      const channel = node.channels[unit];
      const source = channel && passBuffers.get(channel.pass);
      const target = source && source.targets[channel.prev ? source.slots.previous() : source.slots.current()];
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, target?.texture ?? blank);
      if (target) resolutions.set([target.width, target.height, 1], unit * 3);
    }
    gl.uniform3fv(uniforms.iChannelResolution, resolutions);
  };

  /**
   * Runs every Pass of `current` once, each into its buffer in `passBuffers` (sized already), and
   * `main` to the canvas when it has no buffer. Taking the buffers as an argument leaves room for
   * an off-screen run at another size (Output size Capture, #24) that never touches the live ones.
   */
  const runPasses = (current: PassGraph, frame: FrameInputs, passBuffers: Map<string, PassBuffer>) => {
    for (const name of current.order) {
      const node = current.passes[name]!;
      const { program, uniforms: u, parameters } = programs.get(name)!;
      const buffer = passBuffers.get(name);
      const target = buffer?.targets[buffer.slots.write()];
      const [width, height] = target ? [target.width, target.height] : [frame.width, frame.height];

      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.uniform3f(u.iResolution, width, height, 1);
      gl.uniform1f(u.iTime, frame.time);
      gl.uniform1f(u.iTimeDelta, frame.timeDelta);
      gl.uniform1i(u.iFrame, frame.frame);
      gl.uniform4f(u.iMouse, ...frame.mouse);
      setParameterUniforms(gl, parameters, frame.parameters ?? []);
      bindChannels(node, u, passBuffers);
      drawFullscreen(gl);
      buffer?.slots.written();
    }
  };

  const isRunning = () => graph !== null && graph.order.every((name) => programs.has(name));

  return {
    setShader(pass, shader) {
      const { source, prefixLines } = wrapMainImage(shader.source);
      const result = compileProgram(gl, source);
      if (!result.ok) return { ok: false, log: result.log, prefixLines };
      const old = programs.get(pass);
      if (old) gl.deleteProgram(old.program);
      const uniforms = uniformLocations(gl, result.program);
      gl.useProgram(result.program);
      uniforms.iChannels.forEach((location, unit) => gl.uniform1i(location, unit));
      programs.set(pass, { program: result.program, uniforms, parameters: parameterUniforms(gl, result.program) });
      return { ok: true };
    },

    setGraph(next) {
      freeBuffers();
      graph = next;
      for (const [name, entry] of programs) {
        if (next?.passes[name]) continue;
        gl.deleteProgram(entry.program);
        programs.delete(name);
      }
      if (!next) return;
      for (const name of next.order) {
        const node = next.passes[name]!;
        // Main draws straight to the canvas unless something reads its previous frame.
        if (name === 'main' && !node.feedback) continue;
        buffers.set(name, { node, slots: createSlots(node.feedback), targets: [] });
      }
    },

    isRunning,

    clearBuffers() {
      for (const buffer of buffers.values()) {
        for (const target of buffer.targets) deleteTarget(gl, target);
        buffer.targets = [];
      }
    },

    draw(frame) {
      if (!graph || !isRunning()) return;
      for (const buffer of buffers.values()) {
        fitBuffer(buffer, frame.width, frame.height);
        buffer.slots.beginFrame();
      }

      runPasses(graph, frame, buffers);

      const main = buffers.get('main');
      if (main) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, frame.width, frame.height);
        gl.useProgram(present.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, main.targets[main.slots.current()]!.texture);
        drawFullscreen(gl);
      }
    },
  };
}
