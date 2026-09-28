/**
 * `readPixels` RGBA (rows bottom-up) → image RGBA (rows top-down), ready for `ImageData`.
 * Alpha becomes 255: the canvas is opaque (`alpha: false`), so what the shader writes to alpha
 * never shows, and a translucent PNG would not look like the screen (#8 decision 9).
 */
export function toImageRows(pixels: Uint8Array, width: number, height: number): Uint8ClampedArray<ArrayBuffer> {
  const stride = width * 4;
  if (pixels.length !== stride * height) throw new Error(`픽셀 수가 ${width}×${height}와 맞지 않습니다.`);
  const out = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < height; y++) {
    out.set(pixels.subarray((height - 1 - y) * stride, (height - y) * stride), y * stride);
  }
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return out;
}
