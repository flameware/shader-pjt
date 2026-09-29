import path from 'node:path';
import type { Plugin } from 'vite';
import { captureFileName } from '../src/capture/file-name.ts';
import { videoBitrate } from '../src/recording/encoding.ts';
import { withGit } from '../src/recording/metadata.ts';
import { RECORDING_ENDPOINT, decodeRecordingRequest } from '../src/recording/request.ts';
import { CAPTURES_DIR, type StoreOptions, type StoreResult, serveSaveEndpoint, sketchExists, writeNumbered } from './capture.ts';

/** The longest Recording: the safety cap that ends one automatically (#42 decision 2). */
const MAX_RECORDING_SECONDS = 60;
/**
 * The largest `POST /__recording` body: the longest Recording of a 4K UHD window at its target
 * bitrate (about 57 Mbps, so about 430 MB), plus half again for an encoder overshooting on noisy
 * frames. A bigger body gets a 413, and the browser downloads the mp4 instead.
 */
const MAX_BODY_BYTES = Math.ceil(((MAX_RECORDING_SECONDS * videoBitrate([3840, 2160])) / 8) * 1.5);

/**
 * Saves one `POST /__recording` body as `captures/<sketch>/<sketch>_<time>_<W>x<H>.mp4` with a
 * sidecar `.json` of the same name (`-2` … on a clash, for both), the git state added to it
 * (#42 decisions 11, 12). The Sketch must exist under `sketches/`.
 */
export async function storeRecording(body: Uint8Array, { root, git }: StoreOptions): Promise<StoreResult> {
  const decoded = decodeRecordingRequest(body);
  if (!decoded.ok) return { status: 400, body: { error: decoded.error } };
  const { meta, mp4 } = decoded;
  if (!(await sketchExists(root, meta.sketch))) return { status: 400, body: { error: `Sketch가 없습니다: ${meta.sketch}` } };

  const gitState = await git();
  const sidecar = gitState ? withGit(meta, gitState) : meta;
  const name = (extension: string) => captureFileName(meta.sketch, meta.recordedAt, meta.size, extension);
  const [file] = await writeNumbered(path.join(root, CAPTURES_DIR, meta.sketch), [
    { name: name('mp4'), data: mp4 },
    { name: name('json'), data: `${JSON.stringify(sidecar, null, 2)}\n` },
  ]);
  return { status: 200, body: { path: `${CAPTURES_DIR}/${meta.sketch}/${file}` } };
}

/**
 * The dev server side of Recording: `POST /__recording` writes into `captures/`, which
 * `capturePlugin` keeps out of Vite's watcher (and git ignores).
 */
export function recordingPlugin(): Plugin {
  return {
    name: 'shader-playground:recording',
    configureServer(server) {
      serveSaveEndpoint(server, RECORDING_ENDPOINT, MAX_BODY_BYTES, storeRecording);
    },
  };
}
