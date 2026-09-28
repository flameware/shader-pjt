import type { CanvasLayout } from './layout';

/** Puts the canvas where `canvasLayout` says, in CSS pixels; `letterboxed` outlines a fixed Output size. */
export function placeCanvas(canvas: HTMLCanvasElement, css: CanvasLayout['css'], letterboxed: boolean): void {
  const { style } = canvas;
  style.position = 'fixed';
  style.left = `${css.left}px`;
  style.top = `${css.top}px`;
  style.width = `${css.width}px`;
  style.height = `${css.height}px`;
  canvas.classList.toggle('letterboxed', letterboxed);
}
