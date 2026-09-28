/** Shown instead of the canvas when a required feature is missing. There is no fallback (#10). */
export const UNSUPPORTED_MESSAGE = '이 브라우저는 WebGL2 float 렌더 타깃을 지원하지 않습니다.';

/**
 * The first required feature the context lacks, or null if it has them all. Required features
 * are WebGL2 and `EXT_color_buffer_float`; calling `getExtension` is also what enables the latter.
 */
export function missingRequiredFeature(
  gl: { getExtension(name: string): unknown } | null,
): 'WebGL2' | 'EXT_color_buffer_float' | null {
  if (gl === null) return 'WebGL2';
  if (gl.getExtension('EXT_color_buffer_float') === null) return 'EXT_color_buffer_float';
  return null;
}

/**
 * Whether `rgba32f` buffers may use `linear` filtering (`OES_texture_float_linear`). Optional:
 * without it they fall back to `nearest` with a warning (#10). Calling this enables it.
 */
export function hasFloatLinear(gl: { getExtension(name: string): unknown }): boolean {
  return gl.getExtension('OES_texture_float_linear') !== null;
}
