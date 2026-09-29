import { describe, expect, it } from 'vitest';
import { maxLengthLabel, recordingEnd } from './length';

describe('recording length', () => {
  it('a 10 s max length ends the Recording at exactly 600 frames', () => {
    expect(recordingEnd(599, 10)).toBeNull();
    expect(recordingEnd(600, 10)).toBe('max');
  });

  it('without a max length, the 60 s safety limit ends it at 3600 frames', () => {
    expect(recordingEnd(3599, null)).toBeNull();
    expect(recordingEnd(3600, null)).toBe('safety');
  });

  it('a max length lowered below what is already recorded ends it on the next frame', () => {
    expect(recordingEnd(400, 5)).toBe('max');
  });

  it('names "없음" with the safety limit it still has', () => {
    expect(maxLengthLabel(null)).toBe('없음 (60초 상한)');
    expect(maxLengthLabel(15)).toBe('15초');
  });

  it('nothing recorded yet never ends it', () => {
    expect(recordingEnd(0, 5)).toBeNull();
  });
});
