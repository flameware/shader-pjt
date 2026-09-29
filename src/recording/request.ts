// Imports carry `.ts`: plugins/recording.ts loads this module into the Vite config too.
import { isLocalTimestamp } from '../capture/file-name.ts';
import { encodeFramedRequest, isSafeSketchName, isSide, splitFramedRequest } from '../capture/request.ts';
import { isRenderScale, parseOutputSize } from '../output/output-size.ts';
import type { ParamValue } from '../params/annotation.ts';
import { RECORDING_FPS } from './encoding.ts';
import { type RecordingMetadata, recordingMetadata } from './metadata.ts';

/** Where the browser posts a finished Recording (#42 decision 11); a static build has no such endpoint. */
export const RECORDING_ENDPOINT = '/__recording';

/** The body of `POST /__recording`: the sidecar metadata and the mp4, framed like a Capture's. */
export function encodeRecordingRequest(meta: RecordingMetadata, mp4: Uint8Array): Uint8Array<ArrayBuffer> {
  return encodeFramedRequest(meta, mp4);
}

/** A checked request, or why it was refused. */
export type DecodedRecordingRequest = { ok: true; meta: RecordingMetadata; mp4: Uint8Array } | { ok: false; error: string };

const isCount = (n: unknown) => Number.isInteger(n) && (n as number) > 0;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
/** A value in Parameter notation: number, bool, string (color hex, select name) or vec2 `[x, y]`. */
const isParamValue = (value: unknown): value is ParamValue =>
  isFiniteNumber(value) ||
  typeof value === 'boolean' ||
  typeof value === 'string' ||
  (Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber));

/**
 * The sidecar metadata rebuilt from the fields of `meta` it checked (so nothing else the browser
 * sent is written, and `duration` is recomputed), or what is wrong with it.
 */
function checkMetadata(meta: unknown): { ok: true; meta: RecordingMetadata } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false, error }) as const;
  if (!isObject(meta)) return fail('메타데이터가 객체가 아닙니다.');
  const m = meta;
  if (m.v !== 1) return fail(`메타데이터 버전이 1이 아닙니다: ${String(m.v)}`);
  if (!isSafeSketchName(m.sketch)) return fail(`Sketch 이름을 쓸 수 없습니다: ${JSON.stringify(m.sketch)}`);
  if (!Array.isArray(m.size) || m.size.length !== 2 || !m.size.every(isSide)) return fail(`size가 [w, h]가 아닙니다: ${JSON.stringify(m.size)}`);
  const output = parseOutputSize(m.output);
  if (output === undefined) return fail(`output이 Output size가 아닙니다: ${JSON.stringify(m.output)}`);
  if (!isRenderScale(m.renderScale)) return fail(`renderScale이 fit/full이 아닙니다: ${JSON.stringify(m.renderScale)}`);
  if (typeof m.feedback !== 'boolean') return fail(`feedback이 true/false가 아닙니다: ${JSON.stringify(m.feedback)}`);
  if (m.fps !== RECORDING_FPS) return fail(`fps가 ${RECORDING_FPS}가 아닙니다: ${JSON.stringify(m.fps)}`);
  if (!isCount(m.frames)) return fail(`frames가 양의 정수가 아닙니다: ${JSON.stringify(m.frames)}`);
  if (!isObject(m.paramsAtStart) || !Object.values(m.paramsAtStart).every(isParamValue)) {
    return fail(`paramsAtStart가 Parameter 값이 아닙니다: ${JSON.stringify(m.paramsAtStart)}`);
  }
  if (typeof m.recordedAt !== 'string' || !isLocalTimestamp(m.recordedAt)) return fail(`recordedAt 형식이 아닙니다: ${String(m.recordedAt)}`);
  return {
    ok: true,
    meta: recordingMetadata({
      sketch: m.sketch,
      size: m.size as [number, number],
      output,
      renderScale: m.renderScale,
      feedback: m.feedback,
      frames: m.frames as number,
      paramsAtStart: m.paramsAtStart as Record<string, ParamValue>,
      recordedAt: m.recordedAt,
    }),
  };
}

/** Whether `bytes` starts like an ISO BMFF file: a first box of type `ftyp`. */
const isMp4 = (bytes: Uint8Array) => bytes.length >= 8 && String.fromCharCode(...bytes.subarray(4, 8)) === 'ftyp';

/** Splits and checks a `POST /__recording` body. */
export function decodeRecordingRequest(body: Uint8Array): DecodedRecordingRequest {
  const split = splitFramedRequest(body);
  if (!split.ok) return split;
  const checked = checkMetadata(split.meta);
  if (!checked.ok) return checked;
  if (!isMp4(split.file)) return { ok: false, error: '본문이 mp4가 아닙니다.' };
  return { ok: true, meta: checked.meta, mp4: split.file };
}
