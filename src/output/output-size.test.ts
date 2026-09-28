import { describe, expect, it } from 'vitest';
import { outputKey, outputLabel, outputPixels, parseOutputSize } from './output-size';

describe('parseOutputSize', () => {
  it('accepts window and the four presets', () => {
    for (const value of ['window', '1:1', '4:5', '9:16', '16:9']) expect(parseOutputSize(value)).toBe(value);
  });

  it('accepts [w, h] of positive integers', () => {
    expect(parseOutputSize([2000, 1000])).toEqual([2000, 1000]);
  });

  it('accepts up to 4096 a side, like the presets, so no tiling is ever needed', () => {
    expect(parseOutputSize([4096, 4096])).toEqual([4096, 4096]);
  });

  it('rejects anything else', () => {
    for (const value of ['3:2', '', 0, null, undefined, [0, 10], [1.5, 2], [4097, 100], [100], [1, 2, 3], ['1', '2'], { w: 1 }]) {
      expect(parseOutputSize(value)).toBeUndefined();
    }
  });
});

describe('outputPixels', () => {
  it('gives the preset sizes (2× the 1080 SNS sizes)', () => {
    expect(outputPixels('1:1')).toEqual([2160, 2160]);
    expect(outputPixels('4:5')).toEqual([2160, 2700]);
    expect(outputPixels('9:16')).toEqual([2160, 3840]);
    expect(outputPixels('16:9')).toEqual([3840, 2160]);
  });

  it('gives a custom size as is, and null for window', () => {
    expect(outputPixels([640, 480])).toEqual([640, 480]);
    expect(outputPixels('window')).toBeNull();
  });
});

describe('outputKey / outputLabel', () => {
  it('names presets by their ratio and custom sizes by their pixels', () => {
    expect(outputKey('window')).toBe('window');
    expect(outputKey('4:5')).toBe('4:5');
    expect(outputKey([640, 480])).toBe('640x480');
    expect(outputLabel('window')).toBe('window');
    expect(outputLabel('4:5')).toBe('4:5 · 2160×2700');
    expect(outputLabel([640, 480])).toBe('640×480');
  });
});
