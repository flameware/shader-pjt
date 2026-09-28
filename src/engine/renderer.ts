import { compileProgram, drawFullscreen } from '../gl/program';
import type { ShaderSource } from '../shader-source';
import type { FrameTime } from './clock';
import { wrapMainImage } from './wrap';

export interface FrameInputs extends FrameTime {
  width: number;
  height: number;
  mouse: readonly [number, number, number, number];
}

export type SwapResult = { ok: true } | { ok: false; log: string; prefixLines: number };

interface MainPass {
  program: WebGLProgram;
  uniforms: {
    iResolution: WebGLUniformLocation | null;
    iTime: WebGLUniformLocation | null;
    iTimeDelta: WebGLUniformLocation | null;
    iFrame: WebGLUniformLocation | null;
    iMouse: WebGLUniformLocation | null;
  };
}

/**
 * Draws a Sketch's Main pass to the canvas. `setShader` swaps the program only when the new
 * source compiles; on failure the previous program keeps running. Time and frame count live
 * outside the renderer, so a swap never resets them.
 */
export interface Renderer {
  setShader(shader: ShaderSource): SwapResult;
  /** True once any shader has compiled; until then `draw` leaves the canvas blank. */
  hasProgram(): boolean;
  draw(frame: FrameInputs): void;
}

export function createRenderer(gl: WebGL2RenderingContext): Renderer {
  // The fullscreen triangle needs no attributes, but a bound VAO keeps every driver happy.
  gl.bindVertexArray(gl.createVertexArray());
  let main: MainPass | null = null;

  return {
    setShader(shader) {
      const { source, prefixLines } = wrapMainImage(shader.source);
      const result = compileProgram(gl, source);
      if (!result.ok) return { ok: false, log: result.log, prefixLines };
      if (main) gl.deleteProgram(main.program);
      const { program } = result;
      const at = (name: string) => gl.getUniformLocation(program, name);
      main = {
        program,
        uniforms: {
          iResolution: at('iResolution'),
          iTime: at('iTime'),
          iTimeDelta: at('iTimeDelta'),
          iFrame: at('iFrame'),
          iMouse: at('iMouse'),
        },
      };
      return { ok: true };
    },

    hasProgram: () => main !== null,

    draw(frame) {
      if (!main) return;
      const { program, uniforms: u } = main;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, frame.width, frame.height);
      gl.useProgram(program);
      gl.uniform3f(u.iResolution, frame.width, frame.height, 1);
      gl.uniform1f(u.iTime, frame.time);
      gl.uniform1f(u.iTimeDelta, frame.timeDelta);
      gl.uniform1i(u.iFrame, frame.frame);
      gl.uniform4f(u.iMouse, ...frame.mouse);
      drawFullscreen(gl);
    },
  };
}
