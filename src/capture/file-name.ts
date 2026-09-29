/**
 * Capture file names (#8 decision 11): `<sketch>_<YYYYMMDD-HHmmss>_<W>x<H>.png`, `-2`, `-3` …
 * on a clash. The time comes from the metadata's `capturedAt`, so the name and the metadata
 * always agree, whichever side (dev server or download) builds the name.
 */

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

/** `2026-09-28T21:30:45+09:00`: local time with the local UTC offset, to the second. */
export function localTimestamp(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day}T${time}${offset < 0 ? '-' : '+'}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

const LOCAL_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})[+-]\d{2}:\d{2}$/;

/** Whether `text` is exactly what `localTimestamp` writes. */
export function isLocalTimestamp(text: string): boolean {
  return LOCAL_TIMESTAMP.test(text);
}

/**
 * The file name for a Capture of `sketch` taken at `capturedAt` (a `localTimestamp`); a
 * Recording follows the same rule with `extension` `mp4` (#42 decision 11).
 */
export function captureFileName(
  sketch: string,
  capturedAt: string,
  [width, height]: readonly [number, number],
  extension = 'png',
): string {
  const match = LOCAL_TIMESTAMP.exec(capturedAt);
  if (!match) throw new Error(`capturedAt 형식이 아닙니다: ${capturedAt}`);
  const [, y, mo, d, h, mi, s] = match;
  return `${sketch}_${y}${mo}${d}-${h}${mi}${s}_${width}x${height}.${extension}`;
}

/** The `n`th candidate for a file name: itself first, then `-2`, `-3` … before the extension. */
export function numberedFileName(name: string, n: number): string {
  return n <= 1 ? name : name.replace(/(\.[^.]+)?$/, `-${n}$1`);
}
