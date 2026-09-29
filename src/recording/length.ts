import { RECORDING_FPS } from './encoding';

/**
 * How long a Recording may run (#42 decisions 2, 13): a chosen max length, or none. Length is
 * video length (frames / 60), so a paused stretch doesn't count (ADR-0006).
 */

/** The max lengths offered, in seconds; `null` is "없음". */
export const MAX_LENGTHS = [null, 5, 10, 15, 30] as const;
export type MaxLength = (typeof MAX_LENGTHS)[number];

export const isMaxLength = (value: unknown): value is MaxLength => MAX_LENGTHS.some((m) => m === value);

/** Even without a max length, a Recording ends at 60 s so memory can't run away. */
export const SAFETY_LIMIT_S = 60;

/**
 * Whether a Recording that has encoded `frames` frames ends now: `'max'` at the max length,
 * `'safety'` at the 60 s safety limit, else `null`. Checked right after each frame is added, so
 * a 10 s Recording ends with exactly 600 frames.
 */
export function recordingEnd(frames: number, maxLength: MaxLength): 'max' | 'safety' | null {
  if (maxLength !== null && frames >= maxLength * RECORDING_FPS) return 'max';
  if (frames >= SAFETY_LIMIT_S * RECORDING_FPS) return 'safety';
  return null;
}
