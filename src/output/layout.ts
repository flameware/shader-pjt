import { MAX_DEVICE_PIXEL_RATIO, renderSize } from '../engine/render-size';
import { type OutputSize, type RenderScale, effectiveRenderScale, outputPixels } from './output-size';

/** CSS pixels kept free around a letterboxed canvas, so the frame's edge stays visible. */
export const LETTERBOX_MARGIN = 16;

export interface CanvasLayoutInput {
  /** The browser window's CSS size. */
  viewport: readonly [number, number];
  dpr: number;
  output: OutputSize;
  renderScale: RenderScale;
}

export interface CanvasLayout {
  /** Where the canvas sits in the window, in CSS pixels. */
  css: { left: number; top: number; width: number; height: number };
  /** The working resolution: the canvas's pixel size, and `iResolution` of the Main pass. */
  render: readonly [number, number];
  /** True for a fixed Output size, whose box is centred with bars around it. */
  letterboxed: boolean;
}

/**
 * Where the canvas goes and how many pixels it renders (#8 decision 3, #9 decisions 1–2).
 *
 * - `window`: the canvas fills the window; render size = CSS size × min(dpr, 2).
 * - A fixed Output size is letterboxed to its aspect ratio, centred, inside a small margin.
 *   `fit` renders the pixels the screen shows: the box is sized in whole render pixels first,
 *   so the ratio holds and CSS size × min(dpr, 2) is exactly the render size. `full` renders the
 *   Output size itself in the same box, and the browser scales it down.
 *
 * The HUD floats over the canvas, so it plays no part here: hiding it never changes the layout.
 */
export function canvasLayout({ viewport, dpr, output, renderScale }: CanvasLayoutInput): CanvasLayout {
  const [viewWidth, viewHeight] = viewport;
  const pixels = outputPixels(output);
  if (pixels === null) {
    return { css: { left: 0, top: 0, width: viewWidth, height: viewHeight }, render: renderSize(viewWidth, viewHeight, dpr), letterboxed: false };
  }

  const scale = Math.min(dpr, MAX_DEVICE_PIXEL_RATIO);
  const [outWidth, outHeight] = pixels;
  const aspect = outWidth / outHeight;
  const availWidth = Math.max(1, Math.floor((viewWidth - 2 * LETTERBOX_MARGIN) * scale));
  const availHeight = Math.max(1, Math.floor((viewHeight - 2 * LETTERBOX_MARGIN) * scale));
  let width: number;
  let height: number;
  if (availWidth / availHeight > aspect) {
    height = availHeight;
    width = Math.max(1, Math.round(height * aspect));
  } else {
    width = availWidth;
    height = Math.max(1, Math.round(width / aspect));
  }

  const cssWidth = width / scale;
  const cssHeight = height / scale;
  const css = { left: (viewWidth - cssWidth) / 2, top: (viewHeight - cssHeight) / 2, width: cssWidth, height: cssHeight };
  const render = effectiveRenderScale(output, renderScale) === 'full' ? pixels : ([width, height] as const);
  return { css, render, letterboxed: true };
}
