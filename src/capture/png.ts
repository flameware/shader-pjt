/**
 * The few PNG chunk operations Capture needs (#8 decision 12): write `tEXt`/`iTXt` chunks and
 * insert them before the image data. No library; runs in the browser and in the dev server.
 */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** CRC-32 as PNG uses it (over a chunk's type and data). */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A whole chunk: length, type, data, CRC. */
export type PngChunk = Uint8Array;

function chunk(type: string, data: Uint8Array): PngChunk {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const latin1 = (text: string) => Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 255);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** `tEXt`: Latin-1 keyword and text. */
export function tEXtChunk(keyword: string, text: string): PngChunk {
  return chunk('tEXt', concat(latin1(keyword), Uint8Array.of(0), latin1(text)));
}

/** `iTXt`: UTF-8 text, uncompressed, no language tag or translated keyword. */
export function iTXtChunk(keyword: string, text: string): PngChunk {
  return chunk('iTXt', concat(latin1(keyword), Uint8Array.of(0, 0, 0, 0, 0), new TextEncoder().encode(text)));
}

interface ChunkAt {
  type: string;
  /** Offset of the chunk's length field. */
  at: number;
  data: Uint8Array;
}

function* chunks(png: Uint8Array): Generator<ChunkAt> {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 12 <= png.length; ) {
    const length = view.getUint32(at);
    yield { type: String.fromCharCode(...png.subarray(at + 4, at + 8)), at, data: png.subarray(at + 8, at + 8 + length) };
    at += 12 + length;
  }
}

const isPng = (png: Uint8Array) => png.length >= 8 && SIGNATURE.every((byte, i) => png[i] === byte);

/** A copy of `png` with `inserted` placed right before its first `IDAT` chunk. */
export function insertBeforeImageData(png: Uint8Array, inserted: readonly PngChunk[]): Uint8Array {
  if (!isPng(png)) throw new Error('PNG가 아닙니다.');
  for (const { type, at } of chunks(png)) {
    if (type === 'IDAT') return concat(png.subarray(0, at), ...inserted, png.subarray(at));
  }
  throw new Error('PNG에 IDAT 청크가 없습니다.');
}

/** `[width, height]` from `IHDR`, or `null` when `bytes` isn't a PNG. */
export function pngSize(bytes: Uint8Array): [number, number] | null {
  if (!isPng(bytes) || bytes.length < 24) return null;
  const first = chunks(bytes).next().value;
  if (!first || first.type !== 'IHDR' || first.data.length < 8) return null;
  const view = new DataView(first.data.buffer, first.data.byteOffset, 8);
  return [view.getUint32(0), view.getUint32(4)];
}

/** Keyword → text of every uncompressed `tEXt` and `iTXt` chunk (for checking saved Captures). */
export function readTextChunks(png: Uint8Array): Record<string, string> {
  const texts: Record<string, string> = {};
  if (!isPng(png)) return texts;
  for (const { type, data } of chunks(png)) {
    const nul = data.indexOf(0);
    if (nul < 0 || (type !== 'tEXt' && type !== 'iTXt')) continue;
    const keyword = String.fromCharCode(...data.subarray(0, nul));
    if (type === 'tEXt') texts[keyword] = String.fromCharCode(...data.subarray(nul + 1));
    else if (data[nul + 1] === 0) {
      // Skip the compression flag and method, then the language tag and translated keyword.
      const language = data.indexOf(0, nul + 3);
      const translated = data.indexOf(0, language + 1);
      texts[keyword] = new TextDecoder().decode(data.subarray(translated + 1));
    }
  }
  return texts;
}
