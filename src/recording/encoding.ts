/**
 * How a Recording is encoded (#42 decisions 7, 8): 60 fps H.264, one video frame per rendered
 * frame (ADR-0006), so a frame's timestamp comes from how many frames came before it, never from
 * the wall clock.
 */

/** Video frames per second; fixed for now (#42 decision 7). */
export const RECORDING_FPS = 60;

/** When the `index`th encoded frame (from 0) is shown in the video, in microseconds (WebCodecs' unit). */
export function frameTimestamp(index: number): number {
  return Math.round((index * 1_000_000) / RECORDING_FPS);
}

/** Seconds of video between key frames. */
const KEY_FRAME_INTERVAL_S = 2;

/** Whether the `index`th encoded frame is forced to be a key frame: the first, then every 2 s. */
export function isKeyFrame(index: number): boolean {
  return index % (KEY_FRAME_INTERVAL_S * RECORDING_FPS) === 0;
}

/** 40 Mbps at 2160×2700 (4:5), scaled by pixel count for other sizes (#42 decision 8). */
export function videoBitrate([width, height]: readonly [number, number]): number {
  return Math.round((40_000_000 * width * height) / (2160 * 2700));
}

/**
 * H.264 levels (ITU-T H.264 Table A-1): `level_idc`, max macroblocks per second and per frame.
 * A frame's sides are also limited to √(8 × max frame size) macroblocks.
 */
const AVC_LEVELS: readonly (readonly [idc: number, maxMbPerSecond: number, maxMbPerFrame: number])[] = [
  [30, 40_500, 1_620],
  [31, 108_000, 3_600],
  [32, 216_000, 5_120],
  [40, 245_760, 8_192],
  [42, 522_240, 8_704],
  [50, 589_824, 22_080],
  [51, 983_040, 36_864],
  [52, 2_073_600, 36_864],
  [60, 4_177_920, 139_264],
  [61, 8_355_840, 139_264],
  [62, 16_711_680, 139_264],
];

/**
 * The WebCodecs codec string for H.264 High profile at the lowest level that holds `size` at
 * 60 fps (`avc1.6400xx`), or `null` when none does.
 */
export function avcCodec([width, height]: readonly [number, number]): string | null {
  const mbWidth = Math.ceil(width / 16);
  const mbHeight = Math.ceil(height / 16);
  const perFrame = mbWidth * mbHeight;
  const level = AVC_LEVELS.find(
    ([, perSecond, maxPerFrame]) =>
      perFrame <= maxPerFrame &&
      perFrame * RECORDING_FPS <= perSecond &&
      Math.max(mbWidth, mbHeight) <= Math.sqrt(8 * maxPerFrame),
  );
  return level === undefined ? null : `avc1.6400${level[0].toString(16).padStart(2, '0')}`;
}

/**
 * The video's frame size for a canvas of `renderSize`: the same, cropped by one pixel on an odd
 * side, since H.264 in 4:2:0 needs even sides (only a `window` render size can be odd).
 */
export function videoSize([width, height]: readonly [number, number]): [number, number] {
  return [width - (width % 2), height - (height % 2)];
}
