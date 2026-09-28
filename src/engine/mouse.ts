/**
 * Tracks the `iMouse` uniform the way Shadertoy does. Positions are in render pixels with the
 * origin at the bottom-left, like `fragCoord`.
 *
 * - `xy`: the pointer position while the button is held; after release, the last held position.
 * - `zw`: the click position. `z` is positive while the button is held and negative otherwise.
 *   `w` is positive only on the frame of the click and negative after it (and after release).
 */
export interface Mouse {
  press(x: number, y: number): void;
  move(x: number, y: number): void;
  release(): void;
  /** Call once after each rendered frame, so `w` is positive for exactly one frame per click. */
  endFrame(): void;
  value(): [number, number, number, number];
}

export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Converts a pointer's client position to render pixels, origin bottom-left (y flipped). */
export function toRenderPixel(
  clientX: number,
  clientY: number,
  rect: CanvasRect,
  renderWidth: number,
  renderHeight: number,
): [number, number] {
  const x = ((clientX - rect.left) / rect.width) * renderWidth;
  const y = (1 - (clientY - rect.top) / rect.height) * renderHeight;
  return [x, y];
}

export function createMouse(): Mouse {
  let clicked = false;
  let down = false;
  let clickFrame = false;
  let x = 0;
  let y = 0;
  let clickX = 0;
  let clickY = 0;

  return {
    press(px, py) {
      clicked = down = clickFrame = true;
      x = clickX = px;
      y = clickY = py;
    },
    move(px, py) {
      if (!down) return;
      x = px;
      y = py;
    },
    release() {
      down = clickFrame = false;
    },
    endFrame() {
      clickFrame = false;
    },
    value() {
      if (!clicked) return [0, 0, 0, 0];
      return [x, y, down ? clickX : -clickX, clickFrame ? clickY : -clickY];
    },
  };
}
