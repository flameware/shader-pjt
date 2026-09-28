/** The playback speeds the play bar and `-`/`=` step through (#9 decision 6). */
export const SPEEDS: readonly number[] = [0.1, 0.25, 0.5, 1, 2, 4];
const SLOWEST = 0.1;
const FASTEST = 4;

/** The next speed step above `speed`, or the top step. */
export function faster(speed: number): number {
  return SPEEDS.find((s) => s > speed) ?? FASTEST;
}

/** The next speed step below `speed`, or the bottom step. */
export function slower(speed: number): number {
  return [...SPEEDS].reverse().find((s) => s < speed) ?? SLOWEST;
}
