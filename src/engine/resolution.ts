/** devicePixelRatio is capped here so a 3× display doesn't cost 2.25× the fragments of a 2× one (#9). */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/** Render size in device pixels for a canvas of the given CSS size: CSS size × min(dpr, 2). */
export function renderSize(cssWidth: number, cssHeight: number, devicePixelRatio: number): [number, number] {
  const scale = Math.min(devicePixelRatio, MAX_DEVICE_PIXEL_RATIO);
  return [Math.max(1, Math.round(cssWidth * scale)), Math.max(1, Math.round(cssHeight * scale))];
}
