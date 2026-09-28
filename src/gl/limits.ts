/** The device limits an off-screen target must fit (#8 decision 8). */
export interface GlSizeLimits {
  maxTextureSize: number;
  maxRenderbufferSize: number;
  maxViewportDims: readonly [number, number];
}

export function glSizeLimits(gl: WebGL2RenderingContext): GlSizeLimits {
  const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
  return {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    maxViewportDims: [viewport[0]!, viewport[1]!],
  };
}

/** Why targets of these sizes can't be allocated on this device, or `null` when they all fit. No tiling (#8 decision 8). */
export function sizeLimitProblem(sizes: readonly (readonly [number, number])[], limits: GlSizeLimits): string | null {
  for (const [w, h] of sizes) {
    const exceeded =
      Math.max(w, h) > limits.maxTextureSize
        ? `MAX_TEXTURE_SIZE ${limits.maxTextureSize}`
        : Math.max(w, h) > limits.maxRenderbufferSize
          ? `MAX_RENDERBUFFER_SIZE ${limits.maxRenderbufferSize}`
          : w > limits.maxViewportDims[0] || h > limits.maxViewportDims[1]
            ? `MAX_VIEWPORT_DIMS ${limits.maxViewportDims[0]}×${limits.maxViewportDims[1]}`
            : null;
    if (exceeded) return `${w}×${h} 버퍼가 이 GPU의 한도(${exceeded})를 넘습니다`;
  }
  return null;
}
