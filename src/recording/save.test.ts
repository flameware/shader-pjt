import { describe, expect, it } from 'vitest';
import type { SaveTransport } from '../capture/save';
import { recordingMetadata } from './metadata';
import { decodeRecordingRequest } from './request';
import { recordingSavedText, saveRecording } from './save';
import { mp4Skeleton } from './test-mp4';

const mp4 = mp4Skeleton();
const meta = recordingMetadata({
  sketch: 'flow',
  size: [2160, 2700],
  output: '4:5',
  renderScale: 'full',
  feedback: false,
  frames: 600,
  paramsAtStart: {},
  recordedAt: '2026-09-28T21:30:45+09:00',
});

function transport(reply: () => Promise<{ status: number; json: unknown }>) {
  const posted: Uint8Array[] = [];
  const downloads: { name: string; bytes: Uint8Array }[] = [];
  const t: SaveTransport = {
    async post(body) {
      posted.push(body);
      return reply();
    },
    download: (bytes, name) => void downloads.push({ name, bytes }),
  };
  return { t, posted, downloads };
}

describe('saveRecording', () => {
  it('posts the sidecar metadata and the mp4 to the dev server and reports the path it wrote', async () => {
    const { t, posted, downloads } = transport(async () => ({ status: 200, json: { path: 'captures/flow/x.mp4' } }));
    expect(await saveRecording(meta, mp4, t)).toEqual({ saved: 'dev-server', path: 'captures/flow/x.mp4' });
    expect(decodeRecordingRequest(posted[0]!)).toEqual({ ok: true, meta, mp4 });
    expect(downloads).toEqual([]);
  });

  it('downloads just the mp4 when there is no endpoint (static build)', async () => {
    for (const reply of [
      async () => ({ status: 404, json: null }),
      async () => ({ status: 405, json: null }),
      async () => Promise.reject(new TypeError('Failed to fetch')),
      async () => ({ status: 200, json: null }),
    ]) {
      const { t, downloads } = transport(reply);
      expect(await saveRecording(meta, mp4, t)).toEqual({ saved: 'download', fileName: 'flow_20260928-213045_2160x2700.mp4' });
      expect(downloads).toEqual([{ name: 'flow_20260928-213045_2160x2700.mp4', bytes: mp4 }]);
    }
  });

  it('downloads too when the dev server fails, and passes the reason on', async () => {
    const { t, downloads } = transport(async () => ({ status: 413, json: { error: '요청 본문이 너무 큽니다.' } }));
    expect(await saveRecording(meta, mp4, t)).toEqual({
      saved: 'download',
      fileName: 'flow_20260928-213045_2160x2700.mp4',
      problem: '요청 본문이 너무 큽니다.',
    });
    expect(downloads).toHaveLength(1);
  });
});

describe('recordingSavedText', () => {
  it('names the saved path, or the download and why the dev server did not take it', () => {
    expect(recordingSavedText({ saved: 'dev-server', path: 'captures/flow/x.mp4' })).toBe('Recording 저장: captures/flow/x.mp4');
    expect(recordingSavedText({ saved: 'download', fileName: 'x.mp4' })).toBe('Recording 저장 (다운로드): x.mp4');
    expect(recordingSavedText({ saved: 'download', fileName: 'x.mp4', problem: 'disk full' })).toBe('dev server 저장 실패(disk full) → 다운로드: x.mp4');
  });
});
