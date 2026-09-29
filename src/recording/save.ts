import { captureFileName } from '../capture/file-name';
import { type SaveOutcome, type SaveTransport, fetchTransport, saveOrDownload } from '../capture/save';
import type { RecordingMetadata } from './metadata';
import { RECORDING_ENDPOINT, encodeRecordingRequest } from './request';

/** Recording's transport: `/__recording`, mp4 downloads. */
export const recordingTransport: SaveTransport = fetchTransport(RECORDING_ENDPOINT, 'video/mp4');

/**
 * Saves a finished Recording's mp4 described by `meta` (#42 decision 11). The dev server writes it
 * to `captures/<sketch>/` with a sidecar `.json` and adds `git`. Without that endpoint, or when
 * the dev server fails, just the mp4 is downloaded under the same name.
 */
export function saveRecording(meta: RecordingMetadata, mp4: Uint8Array, transport: SaveTransport = recordingTransport): Promise<SaveOutcome> {
  const fileName = captureFileName(meta.sketch, meta.recordedAt, meta.size, 'mp4');
  return saveOrDownload(encodeRecordingRequest(meta, mp4), { bytes: mp4, fileName }, transport);
}

/** The toast after a Recording is saved: where the file went, and why the dev server didn't take it. */
export function recordingSavedText(outcome: SaveOutcome): string {
  if (outcome.saved === 'dev-server') return `Recording 저장: ${outcome.path}`;
  if (outcome.problem) return `dev server 저장 실패(${outcome.problem}) → 다운로드: ${outcome.fileName}`;
  return `Recording 저장 (다운로드): ${outcome.fileName}`;
}
