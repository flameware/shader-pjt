// Test-only helpers: a PNG skeleton built by hand, independent of the code under test (only `crc32`,
// which has its own check-value test).
import { crc32 } from './png.ts';

export const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** A chunk laid out by hand: length, type, data, CRC. */
export function rawChunk(type: string, data: number[]): number[] {
  const typed = [...new TextEncoder().encode(type), ...data];
  return [...u32(data.length), ...typed, ...u32(crc32(Uint8Array.from(typed)))];
}

/** An 8-bit RGBA PNG skeleton of `width`×`height` (its IDAT isn't real image data). */
export function pngSkeleton(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    ...PNG_SIGNATURE,
    ...rawChunk('IHDR', [...u32(width), ...u32(height), 8, 6, 0, 0, 0]),
    ...rawChunk('IDAT', [1, 2, 3]),
    ...rawChunk('IEND', []),
  ]);
}
