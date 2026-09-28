import { describe, expect, it } from 'vitest';
import { toImageRows } from './pixels';

describe('toImageRows', () => {
  it('flips GL’s bottom-up rows to top-down and makes every pixel opaque', () => {
    // 2×3, bottom row first as readPixels returns it; alpha as the shader wrote it.
    const gl = Uint8Array.from([
      1, 1, 1, 0, 2, 2, 2, 10, // bottom
      3, 3, 3, 20, 4, 4, 4, 30, // middle
      5, 5, 5, 40, 6, 6, 6, 255, // top
    ]);
    expect([...toImageRows(gl, 2, 3)]).toEqual([
      5, 5, 5, 255, 6, 6, 6, 255,
      3, 3, 3, 255, 4, 4, 4, 255,
      1, 1, 1, 255, 2, 2, 2, 255,
    ]);
    // The input is left alone.
    expect(gl[3]).toBe(0);
  });

  it('refuses a buffer of the wrong length', () => {
    expect(() => toImageRows(new Uint8Array(12), 2, 2)).toThrow();
  });
});
