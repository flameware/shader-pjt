export interface FrameTime {
  /** `iTime`, seconds */
  time: number;
  /** `iTimeDelta`, seconds */
  timeDelta: number;
  /** `iFrame` */
  frame: number;
}

/**
 * Drives `iTime`/`iTimeDelta`/`iFrame`. Time is accumulated frame by frame (rather than
 * measured from a start timestamp) so pause and speed control can hook in later. A shader
 * hot swap never touches the clock, which is what keeps time running across swaps.
 */
export interface Clock {
  /** Advances to the frame drawn at `nowMs` (a `requestAnimationFrame` timestamp). */
  tick(nowMs: number): FrameTime;
  /** The next `tick` is frame 0 at time 0 again (part of the engine's reset). */
  reset(): void;
}

export function createClock(): Clock {
  let lastMs: number | null = null;
  let timeMs = 0;
  let frame = -1;

  return {
    reset() {
      lastMs = null;
      timeMs = 0;
      frame = -1;
    },

    tick(nowMs) {
      const deltaMs = lastMs === null ? 0 : nowMs - lastMs;
      lastMs = nowMs;
      timeMs += deltaMs;
      frame += 1;
      return { time: timeMs / 1000, timeDelta: deltaMs / 1000, frame };
    },
  };
}
