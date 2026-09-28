import { describe, expect, it } from 'vitest';
import { createClock } from '../engine/clock';
import { createEngine } from '../engine/engine';
import type { FrameInputs, Renderer } from '../engine/renderer';
import { type KeyInput, createKeymap } from './keymap';
import { addPlaybackKeys, playbackActions } from './playback-controls';

const size = { width: 4, height: 3, mouse: [0, 0, 0, 0] as const };

function setup() {
  const drawn: FrameInputs[] = [];
  let clears = 0;
  const renderer: Renderer = {
    setShader: () => ({ ok: true }),
    setGraph: () => {},
    isRunning: () => true,
    clearBuffers: () => void clears++,
    draw: (frame) => void drawn.push(frame),
  };
  const engine = createEngine(renderer, createClock());
  const keymap = createKeymap();
  addPlaybackKeys(keymap, playbackActions(engine));
  const press = (key: string) =>
    keymap.handle({ key, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, repeat: false, target: null } satisfies KeyInput);
  return { engine, press, drawn, clears: () => clears };
}

describe('playback shortcuts', () => {
  it('Space pauses and plays', () => {
    const { engine, press } = setup();
    press(' ');
    expect(engine.playback.isPaused()).toBe(true);
    press(' ');
    expect(engine.playback.isPaused()).toBe(false);
  });

  it('R resets: the next frame is iFrame 0 at iTime 0 with cleared buffers', () => {
    const { engine, press, drawn, clears } = setup();
    engine.frame(1000, size);
    engine.frame(1500, size);
    press('r');
    engine.frame(1516, size);
    expect(drawn.at(-1)).toMatchObject({ frame: 0, time: 0 });
    expect(clears()).toBe(1);
  });

  it('. advances exactly one frame', () => {
    const { engine, press, drawn } = setup();
    engine.frame(1000, size);
    press(' ');
    press('.');
    engine.frame(1016, size);
    engine.frame(1032, size);
    expect(drawn.map((f) => f.frame)).toEqual([0, 1, 1]);
  });

  it('- and = step the speed down and up, 0 goes back to 1×', () => {
    const { engine, press } = setup();
    const speeds: number[] = [];
    for (const key of ['-', '-', '=', '=', '=', '0']) {
      press(key);
      speeds.push(engine.playback.speed());
    }
    expect(speeds).toEqual([0.5, 0.25, 0.5, 1, 2, 1]);
  });
});
