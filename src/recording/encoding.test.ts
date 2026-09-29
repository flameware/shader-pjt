import { describe, expect, it } from 'vitest';
import { avcCodec, frameTimestamp, isKeyFrame, videoBitrate, videoSize } from './encoding';

describe('frameTimestamp', () => {
  it('is the number of frames encoded so far × 1/60 s, in microseconds', () => {
    expect(frameTimestamp(0)).toBe(0);
    expect(frameTimestamp(1)).toBe(16_667);
    expect(frameTimestamp(3)).toBe(50_000);
    expect(frameTimestamp(60)).toBe(1_000_000);
    expect(frameTimestamp(3600)).toBe(60_000_000);
  });
});

describe('isKeyFrame', () => {
  it('starts with a key frame and puts one every 2 s of video (120 frames)', () => {
    expect([0, 1, 119, 120, 121, 240].map(isKeyFrame)).toEqual([true, false, false, true, false, true]);
  });
});

describe('videoBitrate', () => {
  it('is 40 Mbps at 2160×2700 and scales with the pixel count', () => {
    expect(videoBitrate([2160, 2700])).toBe(40_000_000);
    expect(videoBitrate([1080, 1350])).toBe(10_000_000);
    expect(videoBitrate([1920, 1080])).toBe(14_222_222);
  });
});

describe('avcCodec', () => {
  it('is H.264 High profile at the lowest level whose frame size and 60 fps macroblock rate fit', () => {
    expect(avcCodec([640, 480])).toBe('avc1.64001f'); // 3.1
    expect(avcCodec([1080, 1350])).toBe('avc1.64002a'); // 4.2
    expect(avcCodec([1920, 1080])).toBe('avc1.64002a'); // 4.2
    expect(avcCodec([2160, 2700])).toBe('avc1.640034'); // 5.2: 5.1 holds the frame but not 60 of them a second
    expect(avcCodec([3840, 2160])).toBe('avc1.640034'); // 5.2
  });

  it('is null when no H.264 level holds the size', () => {
    expect(avcCodec([8192, 8192])).toBeNull();
    // Few enough macroblocks for level 6, but one side is longer than any level allows.
    expect(avcCodec([20000, 256])).toBeNull();
  });
});

describe('videoSize', () => {
  it('is the render size, less a pixel on an odd side (H.264 4:2:0 needs even sides)', () => {
    expect(videoSize([2160, 2700])).toEqual([2160, 2700]);
    expect(videoSize([1513, 981])).toEqual([1512, 980]);
  });
});
