// Imports carry `.ts`: plugins/capture.ts loads this module into the Vite config too.
import { isLocalTimestamp } from './file-name.ts';
import type { CaptureMetadata } from './metadata.ts';
import { pngSize } from './png.ts';

/** Where the browser posts Captures (#8 decision 10); a static build has no such endpoint. */
export const CAPTURE_ENDPOINT = '/__capture';

/**
 * The body of `POST /__capture`: a 4-byte big-endian length, the metadata as UTF-8 JSON, then
 * the PNG. Binary, so a 4K Capture isn't inflated by base64; the JSON comes first so the dev
 * server can validate it before touching the disk.
 */
export function encodeCaptureRequest(meta: CaptureMetadata, png: Uint8Array): Uint8Array<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify(meta));
  const body = new Uint8Array(4 + json.length + png.length);
  new DataView(body.buffer).setUint32(0, json.length);
  body.set(json, 4);
  body.set(png, 4 + json.length);
  return body;
}

/** A checked request, or why it was refused. */
export type DecodedCaptureRequest = { ok: true; meta: CaptureMetadata; png: Uint8Array } | { ok: false; error: string };

/** Longest side the dev server accepts (above any GPU's `MAX_TEXTURE_SIZE`). */
const MAX_SIDE = 32768;

/**
 * Whether `name` can be used as the one folder level under `captures/`: not empty, not `.`/`..`
 * or hidden, no path separators or control characters. (The dev server also requires
 * `sketches/<name>/` to exist.)
 */
export function isSafeSketchName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 200 &&
    !name.startsWith('.') &&
    !/[/\\\x00-\x1f\x7f]/.test(name)
  );
}

const isSide = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_SIDE;

/** What is wrong with `meta` for naming and writing the file, or `null`. */
function metadataProblem(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return '메타데이터가 객체가 아닙니다.';
  const m = meta as Record<string, unknown>;
  if (m.v !== 1) return `메타데이터 버전이 1이 아닙니다: ${String(m.v)}`;
  if (!isSafeSketchName(m.sketch)) return `Sketch 이름을 쓸 수 없습니다: ${JSON.stringify(m.sketch)}`;
  if (m.kind !== 'screen' && m.kind !== 'output') return `kind가 screen/output이 아닙니다: ${String(m.kind)}`;
  if (!Array.isArray(m.size) || m.size.length !== 2 || !m.size.every(isSide)) return `size가 [w, h]가 아닙니다: ${JSON.stringify(m.size)}`;
  if (typeof m.capturedAt !== 'string' || !isLocalTimestamp(m.capturedAt)) return `capturedAt 형식이 아닙니다: ${String(m.capturedAt)}`;
  return null;
}

/** Splits and checks a `POST /__capture` body. The metadata's size must match the PNG's. */
export function decodeCaptureRequest(body: Uint8Array): DecodedCaptureRequest {
  if (body.length < 4) return { ok: false, error: '요청 본문이 너무 짧습니다.' };
  const length = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(0);
  if (4 + length > body.length) return { ok: false, error: '메타데이터 길이가 본문보다 깁니다.' };
  let meta: unknown;
  try {
    meta = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.subarray(4, 4 + length)));
  } catch {
    return { ok: false, error: '메타데이터 JSON을 읽을 수 없습니다.' };
  }
  const problem = metadataProblem(meta);
  if (problem) return { ok: false, error: problem };
  const png = body.subarray(4 + length);
  const size = pngSize(png);
  if (!size) return { ok: false, error: '본문이 PNG가 아닙니다.' };
  const [width, height] = (meta as CaptureMetadata).size;
  if (size[0] !== width || size[1] !== height) {
    return { ok: false, error: `PNG 크기 ${size[0]}×${size[1]}가 메타데이터 크기 ${width}×${height}와 다릅니다.` };
  }
  return { ok: true, meta: meta as CaptureMetadata, png };
}
