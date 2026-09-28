import type { CanvasLayout } from './layout';

const placed = new WeakMap<HTMLCanvasElement, string>();

/** Puts the canvas where `canvasLayout` says, in CSS pixels, and outlines a letterboxed one. Called every frame; writes only on change. */
export function placeCanvas(canvas: HTMLCanvasElement, { css, letterboxed }: CanvasLayout): void {
  const key = `${css.left},${css.top},${css.width},${css.height},${letterboxed}`;
  if (placed.get(canvas) === key) return;
  placed.set(canvas, key);
  const { style } = canvas;
  style.position = 'fixed';
  style.left = `${css.left}px`;
  style.top = `${css.top}px`;
  style.width = `${css.width}px`;
  style.height = `${css.height}px`;
  canvas.classList.toggle('letterboxed', letterboxed);
}
