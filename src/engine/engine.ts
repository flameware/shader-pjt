import type { ParameterUniform } from '../params/values';
import type { ShaderSource } from '../shader-source';
import type { PassGraph } from '../sketch/graph';
import type { Clock, ClockTick } from './clock';
import type { Renderer, SwapResult } from './renderer';

export interface FrameSize {
  /**
   * The render size (working resolution) in device pixels. A change on its own (a window resize
   * under `fit`) keeps time and Feedback; a new Output size or render scale also calls `reset()`.
   */
  width: number;
  height: number;
  mouse: readonly [number, number, number, number];
  /** Current Parameter values (#19). */
  parameters?: readonly ParameterUniform[];
}

/** The play bar's and shortcuts' handle on time: pause, single-frame step and speed. */
export type Playback = Pick<Clock, 'setPaused' | 'isPaused' | 'step' | 'setSpeed' | 'speed'>;

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
  /** Time 0, `iFrame` 0, Feedback buffers cleared. Pause state and speed are kept. */
  reset(): void;
  readonly playback: Playback;
  /**
   * True while a paused Feedback Sketch holds its picture: the next `frame` draws nothing. The
   * caller should then leave the canvas alone (resizing it would clear the held picture).
   */
  isFrozen(): boolean;
  /** Whether the running graph is a Feedback Sketch: some Pass it runs is read with `prev()`. */
  hasFeedback(): boolean;
  /**
   * Advances the clock and draws the frame at `nowMs` (a `requestAnimationFrame` timestamp);
   * returns the time it drew with. While paused, a Sketch without Feedback keeps redrawing the
   * same moment (so Parameter changes show), and a Feedback Sketch is not drawn at all: running
   * its Passes again would feed the frame into itself.
   */
  frame(nowMs: number, size: FrameSize): ClockTick;
}

export function createEngine(renderer: Renderer, clock: Clock): Engine {
  let feedback = false;
  return {
    setShader: (pass, shader) => renderer.setShader(pass, shader),
    setGraph(graph) {
      renderer.setGraph(graph);
      feedback = graph !== null && graph.order.some((name) => graph.passes[name]?.feedback);
      clock.reset();
    },
    isRunning: () => renderer.isRunning(),
    reset() {
      renderer.clearBuffers();
      clock.reset();
    },
    playback: clock,
    isFrozen: () => feedback && !clock.willAdvance(),
    hasFeedback: () => feedback,
    frame(nowMs, size) {
      const tick = clock.tick(nowMs);
      if (tick.advanced || !feedback) renderer.draw({ ...tick, ...size });
      return tick;
    },
  };
}
