import { describe, expect, it } from 'vitest';
import { createMouse, toRenderPixel } from './mouse';

describe('toRenderPixel', () => {
  it('maps a client position to render pixels with the origin at the bottom-left', () => {
    const rect = { left: 100, top: 50, width: 400, height: 300 };
    // The canvas renders at 2× its CSS size.
    expect(toRenderPixel(100, 350, rect, 800, 600)).toEqual([0, 0]);
    expect(toRenderPixel(500, 50, rect, 800, 600)).toEqual([800, 600]);
    expect(toRenderPixel(200, 275, rect, 800, 600)).toEqual([200, 150]);
  });
});

describe('iMouse (Shadertoy semantics)', () => {
  it('is all zeros before the first click', () => {
    const mouse = createMouse();
    mouse.move(10, 20);
    expect(mouse.value()).toEqual([0, 0, 0, 0]);
  });

  it('on the click frame, xy and zw are the click position and both z and w are positive', () => {
    const mouse = createMouse();
    mouse.press(10, 20);
    expect(mouse.value()).toEqual([10, 20, 10, 20]);
  });

  it('after the click frame, w turns negative while z stays positive as long as the button is held', () => {
    const mouse = createMouse();
    mouse.press(10, 20);
    mouse.endFrame();
    expect(mouse.value()).toEqual([10, 20, 10, -20]);
  });

  it('while dragging, xy follows the pointer and zw stays at the click position', () => {
    const mouse = createMouse();
    mouse.press(10, 20);
    mouse.endFrame();
    mouse.move(30, 40);
    expect(mouse.value()).toEqual([30, 40, 10, -20]);
  });

  it('after release, z is negative and xy keeps the last drag position', () => {
    const mouse = createMouse();
    mouse.press(10, 20);
    mouse.move(30, 40);
    mouse.release();
    mouse.move(99, 99);
    expect(mouse.value()).toEqual([30, 40, -10, -20]);
  });

  it('a new click replaces the previous click position', () => {
    const mouse = createMouse();
    mouse.press(10, 20);
    mouse.release();
    mouse.endFrame();
    mouse.press(50, 60);
    expect(mouse.value()).toEqual([50, 60, 50, 60]);
  });
});
