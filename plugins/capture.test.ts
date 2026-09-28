import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureMetadata } from '../src/capture/metadata.ts';
import { readTextChunks } from '../src/capture/png.ts';
import { pngSkeleton } from '../src/capture/test-png.ts';
import { encodeCaptureRequest } from '../src/capture/request.ts';
import { storeCapture } from './capture.ts';

const png = pngSkeleton(4, 3);

const request = (sketch: string) =>
  encodeCaptureRequest(
    captureMetadata({
      sketch,
      kind: 'screen',
      size: [4, 3],
      output: 'window',
      renderScale: 'fit',
      feedback: true,
      frame: { time: 1.5, frame: 90, mouse: [1, 2, 3, 4] },
      parameters: [],
      capturedAt: '2026-09-28T21:30:45+09:00',
    }),
    png,
  );

let root: string;
const git = async () => ({ commit: 'abc1234', dirty: true });

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'capture-'));
  mkdirSync(path.join(root, 'sketches', '2026-09-28-흐름'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('storeCapture', () => {
  it('writes captures/<sketch>/<name>.png with the metadata and git state embedded', async () => {
    const result = await storeCapture(request('2026-09-28-흐름'), { root, git });
    expect(result).toEqual({ status: 200, body: { path: 'captures/2026-09-28-흐름/2026-09-28-흐름_20260928-213045_4x3.png' } });

    const saved = readFileSync(path.join(root, 'captures', '2026-09-28-흐름', '2026-09-28-흐름_20260928-213045_4x3.png'));
    const texts = readTextChunks(new Uint8Array(saved));
    expect(texts.Software).toBe('shader-playground');
    const meta = JSON.parse(texts['shader-playground']!);
    expect(meta).toMatchObject({ v: 1, sketch: '2026-09-28-흐름', kind: 'screen', iFrame: 90, git: { commit: 'abc1234', dirty: true } });
    expect(Object.keys(meta).slice(-2)).toEqual(['git', 'capturedAt']);
  });

  it('adds -2, -3 when the name is taken', async () => {
    const paths = [];
    for (let i = 0; i < 3; i++) paths.push(((await storeCapture(request('2026-09-28-흐름'), { root, git })).body as { path: string }).path);
    expect(paths.map((p) => path.basename(p))).toEqual([
      '2026-09-28-흐름_20260928-213045_4x3.png',
      '2026-09-28-흐름_20260928-213045_4x3-2.png',
      '2026-09-28-흐름_20260928-213045_4x3-3.png',
    ]);
  });

  it('leaves git out when it is unavailable', async () => {
    await storeCapture(request('2026-09-28-흐름'), { root, git: async () => undefined });
    const [file] = readdirSync(path.join(root, 'captures', '2026-09-28-흐름'));
    const meta = JSON.parse(readTextChunks(new Uint8Array(readFileSync(path.join(root, 'captures', '2026-09-28-흐름', file!))))['shader-playground']!);
    expect(meta.git).toBeUndefined();
  });

  it('refuses path traversal and unknown Sketches without writing anything', async () => {
    mkdirSync(path.join(root, 'sketches', '..', 'outside'), { recursive: true });
    for (const sketch of ['..', '../outside', 'nope', '.']) {
      const result = await storeCapture(request(sketch), { root, git });
      expect(result.status, sketch).toBe(400);
    }
    expect(existsSync(path.join(root, 'captures'))).toBe(false);
  });
});
