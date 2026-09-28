export interface FrameTime {
  /** `iTime`, seconds */
  time: number;
  /** `iTimeDelta`, seconds */
  timeDelta: number;
  /** `iFrame` */
  frame: number;
}

export interface ClockTick extends FrameTime {
  /** False when the clock is paused and this tick repeats the previous frame's time and `iFrame`. */
  advanced: boolean;
}

/**
 * Drives `iTime`/`iTimeDelta`/`iFrame`. Time is accumulated frame by frame (rather than
 * measured from a start timestamp) so pause and speed can act on it. A shader hot swap never
 * touches the clock, which is what keeps time running across swaps.
 */
export interface Clock {
  /** Advances to the frame drawn at `nowMs` (a `requestAnimationFrame` timestamp). */
  tick(nowMs: number): ClockTick;
  /** The next `tick` is frame 0 at time 0 again (part of the engine's reset). */
  reset(): void;
  /** Paused: `tick` repeats the current time and `iFrame` instead of advancing. */
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  /** Pauses (if playing) and makes the next `tick` advance exactly one frame of `STEP_MS` × speed. */
  step(): void;
  /** Multiplies how fast `iTime` runs (and `iTimeDelta` with it); `iFrame` still counts drawn frames. */
  setSpeed(speed: number): void;
  speed(): number;
}

/** How long a single-frame step lasts at 1×: one frame at 60 fps. */
export const STEP_MS = 1000 / 60;

export function createClock(): Clock {
  let lastMs: number | null = null;
  let timeMs = 0;
  let frame = -1;
  let paused = false;
  let speed = 1;
  let stepPending = false;

  return {
    reset() {
      lastMs = null;
      timeMs = 0;
      frame = -1;
      stepPending = false;
    },

    setPaused(next) {
      paused = next;
      stepPending = false;
    },

    isPaused: () => paused,

    step() {
      paused = true;
      stepPending = true;
    },

    setSpeed(next) {
      speed = next;
    },

    speed: () => speed,

    tick(nowMs) {
      const wallMs = lastMs === null ? 0 : nowMs - lastMs;
      lastMs = nowMs;
      // Frame 0 is always drawn, so a reset while paused still shows the start.
      const advanced = !paused || stepPending || frame < 0;
      if (!advanced) return { time: timeMs / 1000, timeDelta: 0, frame, advanced };
      const deltaMs = (frame < 0 ? 0 : stepPending ? STEP_MS : wallMs) * speed;
      stepPending = false;
      timeMs += deltaMs;
      frame += 1;
      return { time: timeMs / 1000, timeDelta: deltaMs / 1000, frame, advanced };
    },
  };
}
