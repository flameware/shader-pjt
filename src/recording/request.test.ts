import { describe, expect, it } from 'vitest';
import { recordingMetadata } from './metadata';
import { decodeRecordingRequest, encodeRecordingRequest } from './request';
import { mp4Skeleton } from './test-mp4';

const meta = (overrides: Record<string, unknown> = {}) => ({
  ...recordingMetadata({
    sketch: '2026-09-28-흐름',
    size: [2160, 2700],
    output: '4:5',
    renderScale: 'full',
    feedback: true,
    frames: 600,
    paramsAtStart: { speed: 0.5 },
    recordedAt: '2026-09-28T21:30:45+09:00',
  }),
  ...overrides,
});

const decodeWith = (overrides: Record<string, unknown>, mp4 = mp4Skeleton()) =>
  decodeRecordingRequest(encodeRecordingRequest(meta(overrides) as never, mp4));

describe('recording request', () => {
  it('round-trips the metadata (UTF-8 names too) and the mp4 bytes', () => {
    const mp4 = mp4Skeleton();
    expect(decodeRecordingRequest(encodeRecordingRequest(meta() as never, mp4))).toEqual({ ok: true, meta: meta(), mp4 });
  });

  it('uses the Capture framing: a 4-byte length, the JSON, then the file', () => {
    const mp4 = mp4Skeleton();
    const body = encodeRecordingRequest(meta() as never, mp4);
    const length = new DataView(body.buffer).getUint32(0);
    expect(JSON.parse(new TextDecoder().decode(body.subarray(4, 4 + length)))).toEqual(meta());
    expect(body.subarray(4 + length)).toEqual(mp4);
  });

  it('rejects Sketch names that could leave captures/<sketch>/', () => {
    for (const sketch of ['..', '.', '../x', 'a/b', 'a\\b', '', '.hidden', 42]) {
      expect(decodeWith({ sketch }).ok, JSON.stringify(sketch)).toBe(false);
    }
  });

  it('rejects metadata of the wrong shape', () => {
    for (const overrides of [
      { v: 2 },
      { size: [4] },
      { size: [0, 3] },
      { size: [4.5, 3] },
      { frames: 0 },
      { frames: 1.5 },
      { fps: '60' },
      { fps: 30 },
      { output: '3:2' },
      { output: [0, 10] },
      { renderScale: 'half' },
      { feedback: 'yes' },
      { paramsAtStart: null },
      { paramsAtStart: [1, 2] },
      { paramsAtStart: { speed: { nested: true } } },
      { recordedAt: '2026-09-28T21:30:45Z' },
      { recordedAt: '../../../evil' },
    ]) {
      expect(decodeWith(overrides).ok, JSON.stringify(overrides)).toBe(false);
    }
  });

  it('rejects a body that is not an mp4', () => {
    expect(decodeWith({}, new Uint8Array([1, 2, 3]))).toEqual({ ok: false, error: expect.stringMatching(/mp4/) });
    expect(decodeWith({}, new Uint8Array(0)).ok).toBe(false);
  });

  it('rejects truncated or garbled framing', () => {
    expect(decodeRecordingRequest(new Uint8Array([0, 0])).ok).toBe(false);
    expect(decodeRecordingRequest(Uint8Array.from([0, 0, 0, 200, 123])).ok).toBe(false);
    expect(decodeRecordingRequest(Uint8Array.from([0, 0, 0, 1, 123, ...mp4Skeleton()])).ok).toBe(false);
  });
});
