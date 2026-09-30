import { describe, expect, it } from 'vitest';
import { coverCrop } from './cover';

describe('coverCrop', () => {
  it('uses the whole image when the aspect ratios match', () => {
    expect(coverCrop(1000, 500, 200, 100)).toEqual({ offset: [0, 0], scale: [1, 1] });
  });

  it('crops both sides of a wider image equally, keeping its full height', () => {
    // 2:1 image on a 1:1 target: the middle half of its width.
    expect(coverCrop(2000, 1000, 500, 500)).toEqual({ offset: [0.25, 0], scale: [0.5, 1] });
  });

  it('crops top and bottom of a taller image equally, keeping its full width', () => {
    // 1:2 image on a 2:1 target: the middle quarter of its height.
    expect(coverCrop(100, 200, 400, 200)).toEqual({ offset: [0, 0.375], scale: [1, 0.25] });
  });

  it('does not depend on how many pixels either side has, only on their shapes', () => {
    expect(coverCrop(4000, 3000, 1080, 1350)).toEqual(coverCrop(400, 300, 2160, 2700));
  });
});
