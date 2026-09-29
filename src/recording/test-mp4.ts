/** The start of an mp4 for tests: just an `ftyp` box (isom brand), no media. */
export function mp4Skeleton(): Uint8Array {
  const box = new Uint8Array(16);
  new DataView(box.buffer).setUint32(0, box.length);
  box.set(new TextEncoder().encode('ftypisom'), 4);
  return box;
}
