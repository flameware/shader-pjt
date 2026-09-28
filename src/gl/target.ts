import type { BufferFilter, BufferFormat, BufferWrap } from '../sketch/define';

/** A texture with a framebuffer around it: one buffer a Pass draws into and others sample. */
export interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

export interface TargetOptions {
  format: BufferFormat;
  filter: BufferFilter;
  wrap: BufferWrap;
}

/** `rgba16f`/`rgba32f` are renderable thanks to `EXT_color_buffer_float`, which the app requires (#10). */
const INTERNAL_FORMAT = { rgba8: WebGL2RenderingContext.RGBA8, rgba16f: WebGL2RenderingContext.RGBA16F, rgba32f: WebGL2RenderingContext.RGBA32F };
const FILTER = { linear: WebGL2RenderingContext.LINEAR, nearest: WebGL2RenderingContext.NEAREST };
const WRAP = { clamp: WebGL2RenderingContext.CLAMP_TO_EDGE, repeat: WebGL2RenderingContext.REPEAT, mirror: WebGL2RenderingContext.MIRRORED_REPEAT };

/** A new target, cleared to 0 (WebGL zero-fills new textures). */
export function createTarget(gl: WebGL2RenderingContext, options: TargetOptions, width: number, height: number): Target {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, INTERNAL_FORMAT[options.format], width, height);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, FILTER[options.filter]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, FILTER[options.filter]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, WRAP[options.wrap]);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, WRAP[options.wrap]);

  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) console.error(`[gl] ${options.format} ${width}×${height} framebuffer incomplete (0x${status.toString(16)})`);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, target: Target): void {
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

/**
 * A new target of the given size holding `source`'s picture resampled to fit, with the
 * target's own filter (`linear`, or `nearest` where the Sketch asked for it or the device
 * can't filter 32F). `source` is deleted. Used when the working resolution changes but the
 * Sketch keeps running, so Feedback carries on at the new size (#8 decision 4).
 */
export function resampleTarget(gl: WebGL2RenderingContext, source: Target, options: TargetOptions, width: number, height: number): Target {
  const target = createTarget(gl, options, width, height);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source.framebuffer);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.framebuffer);
  gl.blitFramebuffer(0, 0, source.width, source.height, 0, 0, width, height, gl.COLOR_BUFFER_BIT, FILTER[options.filter]);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  deleteTarget(gl, source);
  return target;
}

/** A 1×1 transparent black texture, bound to Channels a Pass doesn't connect. */
export function createBlankTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  // The default min filter wants mipmaps; without them the texture would be incomplete.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  return texture;
}
