import { afterAll, describe, expect, it } from 'vitest';
import { captureFileName, isLocalTimestamp, localTimestamp, numberedFileName } from './file-name';

describe('localTimestamp', () => {
  const tz = process.env.TZ;
  afterAll(() => {
    process.env.TZ = tz;
  });

  it('is local time with the local offset, to the second', () => {
    process.env.TZ = 'Asia/Seoul';
    expect(localTimestamp(new Date('2026-09-28T12:30:45.678Z'))).toBe('2026-09-28T21:30:45+09:00');
  });

  it('writes negative and half-hour offsets, and pads', () => {
    process.env.TZ = 'America/St_Johns'; // -02:30 in September (DST)
    expect(localTimestamp(new Date('2026-09-01T02:05:09Z'))).toBe('2026-08-31T23:35:09-02:30');
    process.env.TZ = 'UTC';
    expect(localTimestamp(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05+00:00');
  });
});

describe('isLocalTimestamp', () => {
  it('accepts only the exact local-offset form', () => {
    expect(isLocalTimestamp('2026-09-28T21:30:45+09:00')).toBe(true);
    expect(isLocalTimestamp('2026-09-28T21:30:45-02:30')).toBe(true);
    expect(isLocalTimestamp('2026-09-28T21:30:45Z')).toBe(false);
    expect(isLocalTimestamp('2026-09-28T21:30:45.123+09:00')).toBe(false);
    expect(isLocalTimestamp('../../etc+09:00')).toBe(false);
  });
});

describe('captureFileName', () => {
  it('is <sketch>_<YYYYMMDD-HHmmss>_<W>x<H>.png, taking the time as written in capturedAt', () => {
    expect(captureFileName('2026-09-28-flow', '2026-09-28T21:30:45+09:00', [2160, 2700])).toBe(
      '2026-09-28-flow_20260928-213045_2160x2700.png',
    );
    expect(captureFileName('흐름', '2026-01-02T03:04:05-02:30', [800, 600])).toBe('흐름_20260102-030405_800x600.png');
  });

  it('takes another extension for a Recording', () => {
    expect(captureFileName('flow', '2026-09-28T21:30:45+09:00', [2160, 2700], 'mp4')).toBe('flow_20260928-213045_2160x2700.mp4');
  });
});

describe('numberedFileName', () => {
  it('leaves the first as is and adds -2, -3 … before the extension', () => {
    const name = 'flow_20260928-213045_800x600.png';
    expect(numberedFileName(name, 1)).toBe(name);
    expect(numberedFileName(name, 2)).toBe('flow_20260928-213045_800x600-2.png');
    expect(numberedFileName(name, 13)).toBe('flow_20260928-213045_800x600-13.png');
  });

  it('numbers Recording files (mp4, json) the same way', () => {
    expect(numberedFileName('flow_20260928-213045_2160x2700.mp4', 2)).toBe('flow_20260928-213045_2160x2700-2.mp4');
    expect(numberedFileName('flow_20260928-213045_2160x2700.json', 3)).toBe('flow_20260928-213045_2160x2700-3.json');
  });
});
