import { bufferSize } from '../engine/buffers';
import type { CaptureRenderer, FrameInputs } from '../engine/renderer';
import type { GlImage } from './capture';
import type { PassGraph } from '../sketch/graph';
import { type OutputSize, type RenderScale, effectiveRenderScale, outputPixels } from '../output/output-size';

type Vec4 = readonly [number, number, number, number];
type Size = readonly [number, number];

/**
 * `iMouse` moved from one resolution to another (#8 decision 6): xy and the click position zw
 * are stretched by the same ratio. Multiplying by a positive ratio keeps the signs of z and w,
 * which say whether the button is held and whether this is the click frame.
 */
export function scaleMouse(mouse: Vec4, from: Size, to: Size): [number, number, number, number] {
  const sx = to[0] / from[0];
  const sy = to[1] / from[1];
  return [mouse[0] * sx, mouse[1] * sy, mouse[2] * sx, mouse[3] * sy];
}

/**
 * The inputs of an Output size re-render (#8 decisions 5–6): the frame on screen's `iTime`,
 * `iTimeDelta`, `iFrame` and Parameters, drawn at the Output size, with `iMouse` stretched to it.
 */
export function outputFrame(shown: FrameInputs, size: Size): FrameInputs {
  return {
    time: shown.time,
    timeDelta: shown.timeDelta,
    frame: shown.frame,
    width: size[0],
    height: size[1],
    mouse: scaleMouse(shown.mouse, [shown.width, shown.height], size),
    ...(shown.parameters ? { parameters: shown.parameters.map((u) => ({ ...u, data: [...u.data] })) } : {}),
  };
}

/**
 * How an Output size Capture is made (#8 decisions 5, ADR-0001): `rerender` runs every Pass once
 * more off-screen at the Output size; `as-shown` saves the frame on screen, which a Feedback
 * Sketch under `full` already draws at the Output size.
 */
export type OutputCaptureMode = 'rerender' | 'as-shown';

/** Whether `Shift+C` can run now, and if not, the reason for the tooltip and the toast. */
export type OutputAvailability = { ok: true; mode: OutputCaptureMode; size: Size } | { ok: false; reason: string };

export function outputCaptureAvailability(input: { output: OutputSize; renderScale: RenderScale; feedback: boolean }): OutputAvailability {
  const size = outputPixels(input.output);
  if (size === null) return { ok: false, reason: 'Output size가 window라서 Output size Capture가 없습니다. 프리셋을 고르세요 (화면 Capture는 C)' };
  if (!input.feedback) return { ok: true, mode: 'rerender', size };
  if (effectiveRenderScale(input.output, input.renderScale) === 'full') return { ok: true, mode: 'as-shown', size };
  return { ok: false, reason: 'Feedback Sketch는 render scale이 full일 때만 Output size Capture를 할 수 있습니다. Output 폴더에서 full로 바꾸세요' };
}

/**
 * The size of every target an Output size re-render allocates, one per running Pass in order
 * (`main` last, at the Output size). Buffer `scale` is taken relative to the Output size and a
 * fixed `size: [w, h]` stays as declared (#8 decision 5).
 */
export function outputTargetSizes(graph: PassGraph, size: Size): [number, number][] {
  return graph.order.map((name) => bufferSize(graph.passes[name]!.buffer.size, size[0], size[1]));
}

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

/** Why these target sizes can't be allocated on this device, or `null` when they all fit. No tiling (#8 decision 8). */
export function sizeLimitProblem(sizes: readonly Size[], limits: GlSizeLimits): string | null {
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

/**
 * One Output size Capture, or why there is none: `unavailable` (the button is disabled for the
 * same reason), `no-frame` (nothing at the Output size on screen yet), `error` (the device
 * couldn't render it; the banner shows it and live rendering carries on).
 */
export type OutputCaptureResult =
  | { ok: true; image: GlImage; frame: FrameInputs }
  | { ok: false; problem: 'unavailable' | 'no-frame' | 'error'; message: string };

const NO_FRAME = 'Capture할 프레임이 아직 없습니다 (컴파일된 버전이 없음)';

/**
 * Takes an Output size Capture of the frame on screen. Call it in the first animation frame
 * after the request, before `engine.frame` advances time (#8 decision 6), so the re-render uses
 * that frame's `iTime`/`iTimeDelta`/`iFrame`/Parameters; paused or not makes no difference.
 */
export function takeOutputCapture(
  availability: OutputAvailability,
  renderer: Pick<CaptureRenderer, 'lastFrame' | 'renderOffscreen' | 'readMain'>,
): OutputCaptureResult {
  if (!availability.ok) return { ok: false, problem: 'unavailable', message: availability.reason };
  const [width, height] = availability.size;

  if (availability.mode === 'as-shown') {
    // ADR-0001: a Feedback Sketch under `full` already draws at the Output size; save it as is.
    const image = renderer.readMain();
    if (!image) return { ok: false, problem: 'no-frame', message: NO_FRAME };
    if (image.width !== width || image.height !== height)
      return { ok: false, problem: 'no-frame', message: 'Output size로 그린 프레임이 아직 없습니다. 다시 시도하세요' };
    return { ok: true, image, frame: image.frame };
  }

  const shown = renderer.lastFrame();
  if (!shown) return { ok: false, problem: 'no-frame', message: NO_FRAME };
  const frame = outputFrame(shown, availability.size);
  const result = renderer.renderOffscreen(frame);
  if (!result.ok) return { ok: false, problem: 'error', message: result.error };
  return { ok: true, image: { width: result.width, height: result.height, pixels: result.pixels }, frame };
}
