import { describe, expect, it } from 'vitest';
import { crc32, iTXtChunk, insertBeforeImageData, pngSize, readTextChunks, tEXtChunk } from './png';
import { PNG_SIGNATURE, pngSkeleton, rawChunk, u32 } from './test-png';

const ascii = (text: string) => new TextEncoder().encode(text);
const SIGNATURE = PNG_SIGNATURE;
const IHDR = rawChunk('IHDR', [...u32(3), ...u32(2), 8, 6, 0, 0, 0]);
const png = pngSkeleton(3, 2);

function chunkTypes(bytes: Uint8Array): string[] {
  const types: string[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 8; at < bytes.length; at += 12 + view.getUint32(at)) {
    types.push(String.fromCharCode(...bytes.subarray(at + 4, at + 8)));
  }
  return types;
}

describe('crc32', () => {
  it('matches the standard check values', () => {
    expect(crc32(ascii('123456789'))).toBe(0xcbf43926);
    // Every PNG's IEND chunk ends in AE 42 60 82.
    expect(crc32(ascii('IEND'))).toBe(0xae426082);
  });
});

describe('PNG text chunks', () => {
  it('inserts chunks right before the first IDAT and keeps the rest', () => {
    const out = insertBeforeImageData(png, [tEXtChunk('Software', 'shader-playground')]);
    expect(chunkTypes(out)).toEqual(['IHDR', 'tEXt', 'IDAT', 'IEND']);
    expect([...out.subarray(0, 8)]).toEqual(SIGNATURE);
    expect(out.length).toBe(png.length + 12 + 'Software'.length + 1 + 'shader-playground'.length);
  });

  it('writes tEXt as keyword, NUL, Latin-1 text with a valid CRC', () => {
    const out = insertBeforeImageData(png, [tEXtChunk('Software', 'shader-playground')]);
    const at = SIGNATURE.length + IHDR.length;
    expect([...out.subarray(at, at + 4)]).toEqual(u32(26));
    expect(String.fromCharCode(...out.subarray(at + 4, at + 8 + 26))).toBe('tEXtSoftware\0shader-playground');
    const crc = new DataView(out.buffer).getUint32(at + 8 + 26);
    expect(crc).toBe(crc32(out.subarray(at + 4, at + 8 + 26)));
  });

  it('writes iTXt uncompressed with UTF-8 text that reads back', () => {
    const json = JSON.stringify({ sketch: '2026-09-28-흐름', v: 1 });
    const out = insertBeforeImageData(png, [iTXtChunk('shader-playground', json), tEXtChunk('Software', 'shader-playground')]);
    expect(chunkTypes(out)).toEqual(['IHDR', 'iTXt', 'tEXt', 'IDAT', 'IEND']);
    expect(readTextChunks(out)).toEqual({ 'shader-playground': json, Software: 'shader-playground' });
    // After the keyword: NUL, compression flag 0, method 0, empty language tag NUL, empty translated keyword NUL.
    const at = SIGNATURE.length + IHDR.length + 8 + 'shader-playground'.length;
    expect([...out.subarray(at, at + 5)]).toEqual([0, 0, 0, 0, 0]);
  });

  it('refuses bytes that are not a PNG, or have no IDAT', () => {
    expect(() => insertBeforeImageData(ascii('GIF89a......'), [])).toThrow(/PNG/);
    const noData = Uint8Array.from([...SIGNATURE, ...IHDR, ...rawChunk('IEND', [])]);
    expect(() => insertBeforeImageData(noData, [])).toThrow(/IDAT/);
  });

  it('reads the image size from IHDR', () => {
    expect(pngSize(png)).toEqual([3, 2]);
    expect(pngSize(ascii('nope'))).toBeNull();
  });
});
