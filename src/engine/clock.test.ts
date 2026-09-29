import { describe, expect, it } from 'vitest';
import { createClock } from './clock';

describe('clock', () => {
  it('starts at iTime 0, iTimeDelta 0, iFrame 0 on the first frame', () => {
    const clock = createClock();
    expect(clock.tick(5000)).toEqual({ time: 0, timeDelta: 0, frame: 0, advanced: true });
  });

  it('advances iTime by the wall-clock seconds between frames and counts frames', () => {
    const clock = createClock();
    clock.tick(5000);
    expect(clock.tick(5016)).toEqual({ time: 0.016, timeDelta: 0.016, frame: 1, advanced: true });
    expect(clock.tick(5050)).toEqual({ time: 0.05, timeDelta: 0.034, frame: 2, advanced: true });
  });

  it('starts over at iTime 0, iFrame 0 on the frame after a reset', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.tick(5016);
    clock.reset();
    expect(clock.tick(5032)).toEqual({ time: 0, timeDelta: 0, frame: 0, advanced: true });
    expect(clock.tick(5048)).toEqual({ time: 0.016, timeDelta: 0.016, frame: 1, advanced: true });
  });
});

describe('clock playback', () => {
  it('while paused, repeats the same iTime and iFrame with iTimeDelta 0', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.tick(5016);
    clock.setPaused(true);
    expect(clock.tick(5032)).toEqual({ time: 0.016, timeDelta: 0, frame: 1, advanced: false });
    expect(clock.tick(9000)).toEqual({ time: 0.016, timeDelta: 0, frame: 1, advanced: false });
  });

  it('resumes from where it paused: the paused wall-clock time is not counted', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.tick(5016);
    clock.setPaused(true);
    clock.tick(5032);
    clock.tick(9000);
    clock.setPaused(false);
    expect(clock.tick(9016)).toEqual({ time: 0.032, timeDelta: 0.016, frame: 2, advanced: true });
  });

  it('a reset while paused still draws frame 0 at time 0 once, then holds', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.tick(5016);
    clock.setPaused(true);
    clock.reset();
    expect(clock.tick(5032)).toEqual({ time: 0, timeDelta: 0, frame: 0, advanced: true });
    expect(clock.tick(5048)).toEqual({ time: 0, timeDelta: 0, frame: 0, advanced: false });
  });

  it('step: while paused, the next tick advances exactly one frame of 1/60 s, then holds', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setPaused(true);
    clock.step();
    expect(clock.tick(9000)).toEqual({ time: 1 / 60, timeDelta: 1 / 60, frame: 1, advanced: true });
    expect(clock.tick(9016)).toMatchObject({ frame: 1, advanced: false });
  });

  it('step while playing pauses and advances one frame', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.step();
    expect(clock.isPaused()).toBe(true);
    expect(clock.tick(5500)).toEqual({ time: 1 / 60, timeDelta: 1 / 60, frame: 1, advanced: true });
  });

  it('speed scales iTime and iTimeDelta but not iFrame', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setSpeed(0.5);
    expect(clock.tick(5020)).toEqual({ time: 0.01, timeDelta: 0.01, frame: 1, advanced: true });
    clock.setSpeed(4);
    expect(clock.tick(5040)).toEqual({ time: 0.09, timeDelta: 0.08, frame: 2, advanced: true });
    expect(clock.speed()).toBe(4);
  });

  it('a step is one frame of 1/60 s at the current speed', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setSpeed(2);
    clock.step();
    expect(clock.tick(5016)).toMatchObject({ time: 2 / 60, timeDelta: 2 / 60, frame: 1 });
  });

  it('reset keeps the pause state and the speed', () => {
    const clock = createClock();
    clock.setSpeed(2);
    clock.setPaused(true);
    clock.reset();
    expect([clock.isPaused(), clock.speed()]).toEqual([true, 2]);
  });
});

describe('clock in fixed-step mode (Recording, ADR-0006)', () => {
  it('advances exactly 1/60 s per tick, whatever wall-clock time passed', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setFixedStep(true);
    expect(clock.tick(5100)).toEqual({ time: 1 / 60, timeDelta: 1 / 60, frame: 1, advanced: true });
    expect(clock.tick(5101)).toEqual({ time: 2 / 60, timeDelta: 1 / 60, frame: 2, advanced: true });
  });

  it('multiplies the fixed step by the speed; iFrame still counts one per tick', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setFixedStep(true);
    clock.setSpeed(2);
    expect(clock.tick(5500)).toEqual({ time: 2 / 60, timeDelta: 2 / 60, frame: 1, advanced: true });
  });

  it('while paused, holds as usual; a step advances one fixed frame', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setFixedStep(true);
    clock.setPaused(true);
    expect(clock.tick(5100)).toMatchObject({ time: 0, frame: 0, advanced: false });
    clock.step();
    expect(clock.tick(5200)).toEqual({ time: 1 / 60, timeDelta: 1 / 60, frame: 1, advanced: true });
  });

  it('a reset starts over at frame 0 and stays in fixed-step mode', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setFixedStep(true);
    clock.tick(5100);
    clock.reset();
    expect(clock.tick(5200)).toEqual({ time: 0, timeDelta: 0, frame: 0, advanced: true });
    expect(clock.tick(9000)).toEqual({ time: 1 / 60, timeDelta: 1 / 60, frame: 1, advanced: true });
  });

  it('back in wall-clock mode, time does not jump by the frames skipped while recording', () => {
    const clock = createClock();
    clock.tick(5000);
    clock.setFixedStep(true);
    clock.tick(5100);
    // Recording held rendering back (backpressure): no tick between 5100 and 9000.
    clock.setFixedStep(false);
    expect(clock.tick(9000)).toEqual({ time: 2 / 60, timeDelta: 1 / 60, frame: 2, advanced: true });
    const next = clock.tick(9016);
    expect(next.time).toBeCloseTo(2 / 60 + 0.016, 10);
    expect(next.timeDelta).toBeCloseTo(0.016, 10);
  });
});
