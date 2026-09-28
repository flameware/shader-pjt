import { describe, expect, it } from 'vitest';
import { captureMetadata } from './metadata';
import { readTextChunks } from './png';
import { pngSkeleton } from './test-png';
import { decodeCaptureRequest } from './request';
import { type SaveTransport, saveCapture } from './save';

const png = pngSkeleton(4, 3);
const meta = captureMetadata({
  sketch: 'flow',
  kind: 'screen',
  size: [4, 3],
  output: 'window',
  renderScale: 'fit',
  feedback: false,
  frame: { time: 1, frame: 60, mouse: [0, 0, 0, 0] },
  parameters: [],
  capturedAt: '2026-09-28T21:30:45+09:00',
});

function transport(reply: (body: Uint8Array) => Promise<{ status: number; json: unknown }>) {
  const posted: Uint8Array[] = [];
  const downloads: { name: string; bytes: Uint8Array }[] = [];
  const t: SaveTransport = {
    async post(body) {
      posted.push(body);
      return reply(body);
    },
    download: (bytes, name) => void downloads.push({ name, bytes }),
  };
  return { t, posted, downloads };
}

describe('saveCapture', () => {
  it('posts the metadata and the plain PNG to the dev server and reports the path it wrote', async () => {
    const { t, posted, downloads } = transport(async () => ({ status: 200, json: { path: 'captures/flow/x.png' } }));
    expect(await saveCapture(meta, png, t)).toEqual({ saved: 'dev-server', path: 'captures/flow/x.png' });
    expect(decodeCaptureRequest(posted[0]!)).toEqual({ ok: true, meta, png });
    expect(downloads).toEqual([]);
  });

  it('downloads instead when there is no endpoint (static build), with the metadata but no git', async () => {
    for (const reply of [
      async () => ({ status: 404, json: null }),
      async () => ({ status: 405, json: null }),
      async () => Promise.reject(new TypeError('Failed to fetch')),
      async () => ({ status: 200, json: null }), // an HTML fallback page, not our endpoint
    ]) {
      const { t, downloads } = transport(reply);
      expect(await saveCapture(meta, png, t)).toEqual({ saved: 'download', fileName: 'flow_20260928-213045_4x3.png' });
      const texts = readTextChunks(downloads[0]!.bytes);
      expect(JSON.parse(texts['shader-playground']!)).toEqual(meta);
      expect(texts.Software).toBe('shader-playground');
    }
  });

  it('downloads too when the dev server fails, and passes the reason on', async () => {
    const { t, downloads } = transport(async () => ({ status: 500, json: { error: 'disk full' } }));
    expect(await saveCapture(meta, png, t)).toEqual({ saved: 'download', fileName: 'flow_20260928-213045_4x3.png', problem: 'disk full' });
    expect(downloads).toHaveLength(1);
  });
});
