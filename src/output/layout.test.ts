import { describe, expect, it } from 'vitest';
import { LETTERBOX_MARGIN, canvasLayout } from './layout';

const M = LETTERBOX_MARGIN;

describe('canvasLayout', () => {
  it('window: the canvas fills the viewport and renders CSS size × dpr', () => {
    expect(canvasLayout({ viewport: [800, 600], dpr: 1.5, output: 'window', renderScale: 'fit' })).toEqual({
      css: { left: 0, top: 0, width: 800, height: 600 },
      render: [1200, 900],
      letterboxed: false,
    });
  });

  it('window ignores full: it is always fit', () => {
    expect(canvasLayout({ viewport: [800, 600], dpr: 1, output: 'window', renderScale: 'full' }).render).toEqual([800, 600]);
  });

  it('caps dpr at 2', () => {
    expect(canvasLayout({ viewport: [800, 600], dpr: 3, output: 'window', renderScale: 'fit' }).render).toEqual([1600, 1200]);
  });

  it('a tall preset in a wide window is pillarboxed: full height, centred', () => {
    // 4:5 in 1000×(500 + 2M) at dpr 1: 400×500 inside the margin.
    const layout = canvasLayout({ viewport: [1000, 500 + 2 * M], dpr: 1, output: '4:5', renderScale: 'fit' });
    expect(layout.css).toEqual({ left: 300, top: M, width: 400, height: 500 });
    expect(layout.render).toEqual([400, 500]);
    expect(layout.letterboxed).toBe(true);
  });

  it('a wide preset in a tall window is letterboxed: full width, centred', () => {
    const layout = canvasLayout({ viewport: [320 + 2 * M, 1000], dpr: 2, output: '16:9', renderScale: 'fit' });
    expect(layout.css).toEqual({ left: M, top: 410, width: 320, height: 180 });
    expect(layout.render).toEqual([640, 360]);
  });

  it('fit keeps the Output size aspect ratio in whole render pixels, and the CSS box is exactly render / dpr', () => {
    const layout = canvasLayout({ viewport: [1440, 877], dpr: 2, output: '4:5', renderScale: 'fit' });
    const [w, h] = layout.render;
    expect(w / h).toBeCloseTo(0.8, 3);
    expect(h).toBe((877 - 2 * M) * 2);
    expect(layout.css.width).toBe(w / 2);
    expect(layout.css.height).toBe(h / 2);
  });

  it('full renders the Output size itself and shows it in the same letterboxed box', () => {
    const fit = canvasLayout({ viewport: [1000, 500 + 2 * M], dpr: 1, output: '4:5', renderScale: 'fit' });
    const full = canvasLayout({ viewport: [1000, 500 + 2 * M], dpr: 1, output: '4:5', renderScale: 'full' });
    expect(full.render).toEqual([2160, 2700]);
    expect(full.css).toEqual(fit.css);
  });

  it('a custom [w, h] letterboxes to its own ratio', () => {
    const layout = canvasLayout({ viewport: [600 + 2 * M, 600 + 2 * M], dpr: 1, output: [300, 100], renderScale: 'full' });
    expect(layout.css).toEqual({ left: M, top: M + 200, width: 600, height: 200 });
    expect(layout.render).toEqual([300, 100]);
  });

  it('never goes below 1×1, even in a tiny window', () => {
    const layout = canvasLayout({ viewport: [10, 10], dpr: 1, output: '9:16', renderScale: 'fit' });
    expect(layout.render[0]).toBeGreaterThanOrEqual(1);
    expect(layout.render[1]).toBeGreaterThanOrEqual(1);
  });
});
