/** Covers the viewport with one triangle, no vertex buffers (uses `gl_VertexID`). */
const FULLSCREEN_TRIANGLE_VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export type CompileResult = { ok: true; program: WebGLProgram } | { ok: false; log: string };

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader | string {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const log = gl.getShaderInfoLog(shader) ?? '';
  gl.deleteShader(shader);
  return log;
}

/** Links a fullscreen-triangle program around a complete fragment shader. Returns the info log on failure. */
export function compileProgram(gl: WebGL2RenderingContext, fragmentSource: string): CompileResult {
  const vs = compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_TRIANGLE_VS);
  if (typeof vs === 'string') return { ok: false, log: vs };
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (typeof fs === 'string') {
    gl.deleteShader(vs);
    return { ok: false, log: fs };
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return { ok: true, program };
  const log = gl.getProgramInfoLog(program) ?? '';
  gl.deleteProgram(program);
  return { ok: false, log };
}

/** Draws the fullscreen triangle with whatever program and framebuffer are bound. */
export function drawFullscreen(gl: WebGL2RenderingContext): void {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
