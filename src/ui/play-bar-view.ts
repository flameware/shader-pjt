export interface PlayBarState {
  paused: boolean;
  speed: number;
  /** `iTime` of the frame on screen, seconds. */
  time: number;
  /** `iFrame` of the frame on screen. */
  frame: number;
  /** How often the page draws, frames per second. */
  fps: number;
}

/** The text the play bar shows (#9 decision 6). */
export interface PlayBarView {
  toggle: string;
  toggleTitle: string;
  speed: string;
  clock: string;
}

export function playBarView({ paused, speed, time, frame, fps }: PlayBarState): PlayBarView {
  return {
    toggle: paused ? '▶' : '⏸',
    toggleTitle: paused ? '재생 (Space)' : '일시정지 (Space)',
    speed: `${speed}×`,
    clock: `t ${time.toFixed(2)}s · f ${Math.max(frame, 0)} · ${Math.round(fps)} fps`,
  };
}

const WINDOW_MS = 500;

/**
 * Counts `requestAnimationFrame` callbacks: the page's real frame rate, whatever the playback
 * speed or pause. It averages over half-second windows so the number is readable.
 */
export function createFpsMeter(): { tick(nowMs: number): number } {
  let windowStart: number | null = null;
  let frames = 0;
  let fps = 0;
  return {
    tick(nowMs) {
      if (windowStart === null) {
        windowStart = nowMs;
        return fps;
      }
      frames += 1;
      const elapsed = nowMs - windowStart;
      if (elapsed >= WINDOW_MS) {
        fps = (frames * 1000) / elapsed;
        windowStart = nowMs;
        frames = 0;
      }
      return fps;
    },
  };
}
