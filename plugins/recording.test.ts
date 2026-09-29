import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recordingMetadata } from '../src/recording/metadata.ts';
import { encodeRecordingRequest } from '../src/recording/request.ts';
import { mp4Skeleton } from '../src/recording/test-mp4.ts';
import { storeRecording } from './recording.ts';

const SKETCH = '2026-09-28-흐름';
const BASE = `${SKETCH}_20260928-213045_2160x2700`;
const mp4 = mp4Skeleton();

const meta = (sketch: string) =>
  recordingMetadata({
    sketch,
    size: [2160, 2700],
    output: '4:5',
    renderScale: 'full',
    feedback: true,
    frames: 600,
    paramsAtStart: { speed: 0.5, tint: '#ff8800' },
    recordedAt: '2026-09-28T21:30:45+09:00',
  });
const request = (sketch: string) => encodeRecordingRequest(meta(sketch), mp4);

let root: string;
const git = async () => ({ commit: 'abc1234', dirty: true });
const dir = () => path.join(root, 'captures', SKETCH);
const readJson = (file: string) => JSON.parse(readFileSync(path.join(dir(), file), 'utf8'));

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'recording-'));
  mkdirSync(path.join(root, 'sketches', SKETCH), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('storeRecording', () => {
  it('writes captures/<sketch>/<name>.mp4 and a sidecar .json with the git state', async () => {
    const result = await storeRecording(request(SKETCH), { root, git });
    expect(result).toEqual({ status: 200, body: { path: `captures/${SKETCH}/${BASE}.mp4` } });

    expect(new Uint8Array(readFileSync(path.join(dir(), `${BASE}.mp4`)))).toEqual(mp4);
    const sidecar = readJson(`${BASE}.json`);
    expect(sidecar).toEqual({ ...meta(SKETCH), git: { commit: 'abc1234', dirty: true } });
    expect(Object.keys(sidecar).slice(-2)).toEqual(['git', 'recordedAt']);
  });

  it('adds -2, -3 to both files when the name is taken', async () => {
    for (let i = 0; i < 3; i++) await storeRecording(request(SKETCH), { root, git });
    expect(readdirSync(dir()).sort()).toEqual(
      [`${BASE}.mp4`, `${BASE}.json`, `${BASE}-2.mp4`, `${BASE}-2.json`, `${BASE}-3.mp4`, `${BASE}-3.json`].sort(),
    );
  });

  it('never pairs a new mp4 with a sidecar that is already there', async () => {
    mkdirSync(dir(), { recursive: true });
    writeFileSync(path.join(dir(), `${BASE}.json`), '{"left":"over"}');
    const result = await storeRecording(request(SKETCH), { root, git });
    expect(result.body).toEqual({ path: `captures/${SKETCH}/${BASE}-2.mp4` });
    expect(readJson(`${BASE}.json`)).toEqual({ left: 'over' });
    expect(readJson(`${BASE}-2.json`).sketch).toBe(SKETCH);
  });

  it('writes only the sidecar fields it checked: its own git and duration, nothing extra from the browser', async () => {
    const body = encodeRecordingRequest({ ...meta(SKETCH), duration: 99, git: { commit: 'fake', dirty: false }, extra: 1 } as never, mp4);
    await storeRecording(body, { root, git: async () => undefined });
    expect(readJson(`${BASE}.json`)).toEqual(meta(SKETCH));
  });

  it('leaves git out when it is unavailable', async () => {
    await storeRecording(request(SKETCH), { root, git: async () => undefined });
    expect(readJson(`${BASE}.json`).git).toBeUndefined();
  });

  it('refuses path traversal, unknown Sketches and bad bodies without writing anything', async () => {
    mkdirSync(path.join(root, 'sketches', '..', 'outside'), { recursive: true });
    for (const sketch of ['..', '../outside', 'nope', '.']) {
      expect((await storeRecording(request(sketch), { root, git })).status, sketch).toBe(400);
    }
    expect((await storeRecording(encodeRecordingRequest(meta(SKETCH), new Uint8Array([1, 2, 3])), { root, git })).status).toBe(400);
    expect(existsSync(path.join(root, 'captures'))).toBe(false);
  });
});
