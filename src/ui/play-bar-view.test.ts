import { describe, expect, it } from 'vitest';
import { createFpsMeter, playBarView } from './play-bar-view';

const state = { paused: false, speed: 1, time: 0, frame: 0, fps: 60 };

describe('playBarView', () => {
  it('shows pause while playing and play while paused', () => {
    expect(playBarView(state)).toMatchObject({ toggle: '⏸', toggleTitle: '일시정지 (Space)' });
    expect(playBarView({ ...state, paused: true })).toMatchObject({ toggle: '▶', toggleTitle: '재생 (Space)' });
  });

  it('shows the speed as a multiplier', () => {
    expect([0.1, 0.25, 0.5, 1, 2, 4].map((speed) => playBarView({ ...state, speed }).speed)).toEqual([
      '0.1×',
      '0.25×',
      '0.5×',
      '1×',
      '2×',
      '4×',
    ]);
  });

  it('shows t in seconds with two decimals, f, and whole fps', () => {
    expect(playBarView({ ...state, time: 12.345678, frame: 740, fps: 59.6 }).clock).toBe('t 12.35s · f 740 · 60 fps');
  });

  it('shows iFrame 0 before the first frame is drawn', () => {
    expect(playBarView({ ...state, frame: -1 }).clock).toBe('t 0.00s · f 0 · 60 fps');
  });
});

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
