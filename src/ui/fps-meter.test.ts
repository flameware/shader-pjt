import { describe, expect, it } from 'vitest';
import { createFpsMeter } from './fps-meter';

describe('fps meter', () => {
  it('reports 0 until half a second has passed, then the frame rate over that window', () => {
    const meter = createFpsMeter();
    let fps = meter.tick(0);
    for (let t = 20; t < 500; t += 20) fps = meter.tick(t);
    expect(fps).toBe(0);
    expect(meter.tick(500)).toBe(50);
  });

  it('keeps showing the last window while the next one fills', () => {
    const meter = createFpsMeter();
    for (let t = 0; t <= 500; t += 20) meter.tick(t);
    for (let t = 510; t < 1000; t += 10) expect(meter.tick(t)).toBe(50);
    expect(meter.tick(1000)).toBe(100);
  });
});
