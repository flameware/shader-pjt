import { glSizeLimits, outputTargetSizes, sizeLimitProblem } from '../capture/output-capture';
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

/** The Main pass image as `readPixels` returns it (RGBA8, rows bottom-up), and what drew it. */
export interface MainImage {
  width: number;
  height: number;
  pixels: Uint8Array;
  /** The inputs of the frame this image is. */
  frame: FrameInputs;
  /** Whether any running Pass reads a previous frame. */
  feedback: boolean;
}

/** What `createRenderer` makes: a `Renderer` that can also read back the Main pass for Capture. */
export interface CaptureRenderer extends Renderer {
  /**
   * The Main pass of the last frame drawn, as the screen shows it (#8 decision 9, #23), or
   * `null` before anything is drawn. It is drawn into a temporary `RGBA8` target and read there:
   * a Feedback buffer through the display's clamp, otherwise by running main again with that
   * frame's inputs (RGBA8 clamps like the canvas). Works any time, also while a paused Feedback
   * Sketch isn't redrawn.
   */
  readMain(): MainImage | null;
  /** The inputs of the frame on screen (the last one drawn), or `null` before anything is drawn. */
  lastFrame(): FrameInputs | null;
  /**
   * Runs every Pass once off-screen at `frame.width × frame.height` and reads back `main`, for an
   * Output size Capture of a Sketch without Feedback (#8 decision 5). The buffers are temporary:
   * buffer `scale` is taken relative to this size, `size: [w, h]` stays, and all of them are
   * released before this returns. The live buffers, the canvas and the frame on screen are not
   * touched. Sizes beyond the device's limits, `OUT_OF_MEMORY`, an incomplete framebuffer and a
   * lost context come back as an error instead of an image.
   */
  renderOffscreen(frame: FrameInputs): OffscreenResult;
}

/** An off-screen run's `main` (RGBA8, rows bottom-up), or why there is none. */
export type OffscreenResult = { ok: true; width: number; height: number; pixels: Uint8Array } | { ok: false; error: string };

/** `main` is read through RGBA8, which clamps to 0..1 as the canvas does (#8 decision 9). */
const CAPTURE_TARGET = { format: 'rgba8', filter: 'nearest', wrap: 'clamp' } as const;

export function createRenderer(gl: WebGL2RenderingContext): CaptureRenderer {
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
      const buffer = passBuffers.get(name);
      drawPass(current.passes[name]!, buffer?.targets[buffer.slots.write()] ?? null, frame, passBuffers);
      buffer?.slots.written();
    }
  };

  /** Draws one Pass into `target` (`null`: the canvas, at the frame's size), reading its Channels from `passBuffers`. */
  const drawPass = (node: PassNode, target: Target | null, frame: FrameInputs, passBuffers: Map<string, PassBuffer>) => {
    const { program, uniforms: u, parameters } = programs.get(node.name)!;
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
  };

  const isRunning = () => graph !== null && graph.order.every((name) => programs.has(name));
  /** The inputs of the last frame drawn, for `readMain`. */
  let drawn: FrameInputs | null = null;

  const readPixels = (width: number, height: number) => {
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  };

  /** Forgets GL errors raised before an off-screen run, so only its own are reported. Bounded: a lost context keeps answering. */
  const clearErrors = () => {
    for (let i = 0; i < 16 && gl.getError() !== gl.NO_ERROR; i++);
  };

  /** What went wrong on the GPU since `clearErrors`, if anything. */
  const glProblem = (targets: Target[]): string | null => {
    if (gl.isContextLost()) return 'WebGL context를 잃었습니다';
    const error = gl.getError();
    if (error === gl.OUT_OF_MEMORY) return 'GPU 메모리가 모자랍니다 (OUT_OF_MEMORY)';
    for (const target of targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) return `${target.width}×${target.height} 버퍼를 만들지 못했습니다 (framebuffer 0x${status.toString(16)})`;
    }
    if (error !== gl.NO_ERROR) return `GL 오류 0x${error.toString(16)}`;
    return null;
  };

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
      drawn = null;
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
      drawn = frame;
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

    readMain() {
      if (!graph || !isRunning() || !drawn) return null;
      const feedback = graph.order.some((name) => graph!.passes[name]!.feedback);
      const main = buffers.get('main');
      const source = main?.targets[main.slots.current()];
      const [width, height] = source ? [source.width, source.height] : [drawn.width, drawn.height];
      const target = createTarget(gl, CAPTURE_TARGET, width, height);
      try {
        if (source) {
          // The display's clamp, into RGBA8 instead of the canvas.
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
          gl.viewport(0, 0, width, height);
          gl.useProgram(present.program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, source.texture);
          drawFullscreen(gl);
        } else {
          // Main again with the same inputs; the buffers it reads are as they were for that frame.
          drawPass(graph.passes.main!, target, drawn, buffers);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        return { width, height, pixels: readPixels(width, height), frame: drawn, feedback };
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        deleteTarget(gl, target);
      }
    },

    lastFrame: () => drawn,

    renderOffscreen(frame) {
      if (!graph || !isRunning()) return { ok: false, error: '실행 중인 버전이 없습니다' };
      const current = graph;
      const sizes = outputTargetSizes(current, [frame.width, frame.height]);
      const tooBig = sizeLimitProblem(sizes, glSizeLimits(gl));
      if (tooBig) return { ok: false, error: tooBig };

      clearErrors();
      // One target per running Pass: this run is only for Sketches without Feedback, so no Pass
      // needs a second slot, and `main` gets one too instead of the canvas.
      const temporary = new Map<string, PassBuffer>();
      const targets: Target[] = [];
      try {
        current.order.forEach((name, i) => {
          const node = current.passes[name]!;
          const [width, height] = sizes[i]!;
          const target = createTarget(gl, name === 'main' ? CAPTURE_TARGET : node.buffer, width, height);
          targets.push(target);
          temporary.set(name, { node, slots: createSlots(false), targets: [target] });
        });
        const allocation = glProblem(targets);
        if (allocation) return { ok: false, error: allocation };

        for (const buffer of temporary.values()) buffer.slots.beginFrame();
        runPasses(current, frame, temporary);
        const main = temporary.get('main')!.targets[0]!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, main.framebuffer);
        const pixels = readPixels(main.width, main.height);
        const problem = glProblem([]);
        if (problem) return { ok: false, error: problem };
        return { ok: true, width: main.width, height: main.height, pixels };
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        for (const target of targets) deleteTarget(gl, target);
      }
    },
  };
}
