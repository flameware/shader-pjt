// Imports carry `.ts`: plugins/recording.ts loads this module into the Vite config too.
import { isLocalTimestamp } from '../capture/file-name.ts';
import { encodeFramedRequest, isSafeSketchName, isSide, splitFramedRequest } from '../capture/request.ts';
import type { RecordingMetadata } from './metadata.ts';

/** Where the browser posts a finished Recording (#42 decision 11); a static build has no such endpoint. */
export const RECORDING_ENDPOINT = '/__recording';

/** The body of `POST /__recording`: the sidecar metadata and the mp4, framed like a Capture's. */
export function encodeRecordingRequest(meta: RecordingMetadata, mp4: Uint8Array): Uint8Array<ArrayBuffer> {
  return encodeFramedRequest(meta, mp4);
}

/** A checked request, or why it was refused. */
export type DecodedRecordingRequest = { ok: true; meta: RecordingMetadata; mp4: Uint8Array } | { ok: false; error: string };

const isCount = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

/** What is wrong with `meta` for naming and writing the files, or `null`. */
function metadataProblem(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return '메타데이터가 객체가 아닙니다.';
  const m = meta as Record<string, unknown>;
  if (m.v !== 1) return `메타데이터 버전이 1이 아닙니다: ${String(m.v)}`;
  if (!isSafeSketchName(m.sketch)) return `Sketch 이름을 쓸 수 없습니다: ${JSON.stringify(m.sketch)}`;
  if (!Array.isArray(m.size) || m.size.length !== 2 || !m.size.every(isSide)) return `size가 [w, h]가 아닙니다: ${JSON.stringify(m.size)}`;
  if (!isCount(m.fps)) return `fps가 양의 정수가 아닙니다: ${JSON.stringify(m.fps)}`;
  if (!isCount(m.frames)) return `frames가 양의 정수가 아닙니다: ${JSON.stringify(m.frames)}`;
  if (typeof m.recordedAt !== 'string' || !isLocalTimestamp(m.recordedAt)) return `recordedAt 형식이 아닙니다: ${String(m.recordedAt)}`;
  return null;
}

/** Whether `bytes` starts like an ISO BMFF file: a first box of type `ftyp`. */
const isMp4 = (bytes: Uint8Array) => bytes.length >= 8 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp';

/** Splits and checks a `POST /__recording` body. */
export function decodeRecordingRequest(body: Uint8Array): DecodedRecordingRequest {
  const split = splitFramedRequest(body);
  if (!split.ok) return split;
  const problem = metadataProblem(split.meta);
  if (problem) return { ok: false, error: problem };
  if (!isMp4(split.file)) return { ok: false, error: '본문이 mp4가 아닙니다.' };
  return { ok: true, meta: split.meta as RecordingMetadata, mp4: split.file };
}
