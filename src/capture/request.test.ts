import { describe, expect, it } from 'vitest';
import { captureMetadata } from './metadata';
import { pngSkeleton } from './test-png';
import { decodeCaptureRequest, encodeCaptureRequest, isSafeSketchName } from './request';

const pngOf = pngSkeleton;

const meta = (overrides: Record<string, unknown> = {}) => ({
  ...captureMetadata({
    sketch: '2026-09-28-흐름',
    kind: 'screen',
    size: [4, 3],
    output: 'window',
    renderScale: 'fit',
    feedback: false,
    frame: { time: 1.5, frame: 90, mouse: [0, 0, 0, 0] },
    parameters: [],
    capturedAt: '2026-09-28T21:30:45+09:00',
  }),
  ...overrides,
});

describe('capture request', () => {
  it('round-trips the metadata (UTF-8 names too) and the PNG bytes', () => {
    const png = pngOf(4, 3);
    const decoded = decodeCaptureRequest(encodeCaptureRequest(meta() as never, png));
    expect(decoded).toEqual({ ok: true, meta: meta(), png });
  });

  const decodeWith = (overrides: Record<string, unknown>, png = pngOf(4, 3)) =>
    decodeCaptureRequest(encodeCaptureRequest(meta(overrides) as never, png));

  it('rejects Sketch names that could leave captures/<sketch>/', () => {
    for (const sketch of ['..', '.', '../x', 'a/b', 'a\\b', '', '.hidden', 'a\0b', 'line\nbreak', 42]) {
      const result = decodeWith({ sketch });
      expect(result.ok, JSON.stringify(sketch)).toBe(false);
    }
  });

  it('rejects metadata of the wrong shape', () => {
    for (const overrides of [
      { v: 2 },
      { kind: 'movie' },
      { size: [4] },
      { size: [0, 3] },
      { size: [4.5, 3] },
      { capturedAt: '2026-09-28T21:30:45Z' },
      { capturedAt: '../../../evil' },
    ]) {
      expect(decodeWith(overrides).ok, JSON.stringify(overrides)).toBe(false);
    }
  });

  it('rejects a body that is not a PNG, or a PNG of another size than the metadata says', () => {
    expect(decodeWith({}, new Uint8Array([1, 2, 3])).ok).toBe(false);
    expect(decodeWith({}, pngOf(5, 3))).toEqual({ ok: false, error: expect.stringMatching(/크기/) });
  });

  it('rejects truncated or garbled framing', () => {
    expect(decodeCaptureRequest(new Uint8Array([0, 0])).ok).toBe(false);
    expect(decodeCaptureRequest(Uint8Array.from([0, 0, 0, 200, 123])).ok).toBe(false);
    expect(decodeCaptureRequest(Uint8Array.from([0, 0, 0, 1, 123, ...pngOf(4, 3)])).ok).toBe(false);
  });
});

describe('isSafeSketchName', () => {
  it('accepts ordinary folder names, including Korean', () => {
    expect(isSafeSketchName('2026-09-28-flow')).toBe(true);
    expect(isSafeSketchName('2026-09-28-흐름 2')).toBe(true);
  });
});
