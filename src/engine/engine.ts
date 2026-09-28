import type { ShaderSource } from '../shader-source';
import type { PassGraph } from '../sketch/graph';
import type { Clock } from './clock';
import type { Renderer, SwapResult } from './renderer';

export interface FrameSize {
  /** Canvas size in device pixels. */
  width: number;
  height: number;
  mouse: readonly [number, number, number, number];
}

/**
 * The running Sketch: its pass graph, programs, buffers and clock. The reset rules (#5) live
 * here: a shader swap keeps time and Feedback; a new pass graph, or `reset()`, starts both over.
 */
export interface Engine {
  /** Swaps one Pass's shader if it compiles. Keeps time, `iFrame` and Feedback. */
  setShader(pass: string, shader: ShaderSource): SwapResult;
  /** Replaces the pass graph (`null`: nothing runs) and resets. */
  setGraph(graph: PassGraph | null): void;
  /** Whether a compiled version of the whole graph is on screen. */
  isRunning(): boolean;
  /** Time 0, `iFrame` 0, Feedback buffers cleared. Which key or button calls it is up to the HUD (#18). */
  reset(): void;
  /** Advances the clock and draws the frame at `nowMs` (a `requestAnimationFrame` timestamp). */
  frame(nowMs: number, size: FrameSize): void;
}

export function createEngine(renderer: Renderer, clock: Clock): Engine {
  return {
    setShader: (pass, shader) => renderer.setShader(pass, shader),
    setGraph(graph) {
      renderer.setGraph(graph);
      clock.reset();
    },
    isRunning: () => renderer.isRunning(),
    reset() {
      renderer.clearBuffers();
      clock.reset();
    },
    frame(nowMs, size) {
      renderer.draw({ ...clock.tick(nowMs), ...size });
    },
  };
}
