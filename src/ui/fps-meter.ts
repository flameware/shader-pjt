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
