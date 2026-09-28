import { describe, expect, it } from 'vitest';
import { playBarView } from './play-bar-view';

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
