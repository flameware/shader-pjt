import { describe, expect, it } from 'vitest';
import { createClock } from './clock';

describe('clock', () => {
  it('starts at iTime 0, iTimeDelta 0, iFrame 0 on the first frame', () => {
    const clock = createClock();
    expect(clock.tick(5000)).toEqual({ time: 0, timeDelta: 0, frame: 0 });
  });

  it('advances iTime by the wall-clock seconds between frames and counts frames', () => {
    const clock = createClock();
    clock.tick(5000);
    expect(clock.tick(5016)).toEqual({ time: 0.016, timeDelta: 0.016, frame: 1 });
    expect(clock.tick(5050)).toEqual({ time: 0.05, timeDelta: 0.034, frame: 2 });
  });
});
