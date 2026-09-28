import { localTimestamp } from './file-name';
import { type CaptureMetadataInput, captureMetadata } from './metadata';
import { toImageRows } from './pixels';
import { type SaveOutcome, saveCapture } from './save';

/** Pixels as `readPixels` returns them: RGBA8, rows bottom-up. */
export interface GlImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

/**
 * One Capture to save. `C` (#23) passes the Main pass as shown; `Shift+C` (#24) its re-render.
 * `frame` holds the inputs `image` was drawn with (its `iMouse` in `image`'s pixels); the size
 * comes from `image` and the time of capture from the clock.
 */
export type CaptureInput = Omit<CaptureMetadataInput, 'size' | 'capturedAt'> & { image: GlImage };

/** 8-bit sRGB PNG (no metadata chunks yet) of top-down RGBA rows, through a 2D canvas. */
function encodePng(rows: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(rows, width, height), 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG로 인코딩하지 못했습니다.'))), 'image/png'),
  );
}

/**
 * Flips, encodes, describes and saves one Capture (#8 decisions 9–12). Returns where it went
 * and the PNG, for the toast's thumbnail.
 */
export async function captureImage(input: CaptureInput, now = new Date()): Promise<{ outcome: SaveOutcome; png: Blob }> {
  const { image, ...described } = input;
  const { width, height, pixels } = image;
  const png = await encodePng(toImageRows(pixels, width, height), width, height);
  const meta = captureMetadata({ ...described, size: [width, height], capturedAt: localTimestamp(now) });
  const outcome = await saveCapture(meta, new Uint8Array(await png.arrayBuffer()));
  return { outcome, png };
}
