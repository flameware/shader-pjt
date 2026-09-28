import { describe, expect, it } from 'vitest';
import type { PassGraph } from '../sketch/graph';
import { createClock } from './clock';
import { createEngine } from './engine';
import type { FrameInputs, Renderer } from './renderer';

function fakeRenderer() {
  const frames: FrameInputs[] = [];
  let clears = 0;
  const renderer: Renderer = {
    setShader: () => ({ ok: true }),
    setGraph: () => {},
    isRunning: () => true,
    clearBuffers: () => void clears++,
    draw: (frame) => void frames.push(frame),
  };
  return { renderer, frames, clears: () => clears };
}

const graph: PassGraph = { passes: {}, order: ['main'] };
const size = { width: 4, height: 3, mouse: [0, 0, 0, 0] as const };

describe('engine', () => {
  it('draws each frame with the clock’s time and the given size and mouse', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.frame(1000, size);
    engine.frame(1016, size);
    expect(fake.frames.map((f) => [f.frame, f.time, f.width, f.height])).toEqual([
      [0, 0, 4, 3],
      [1, 0.016, 4, 3],
    ]);
  });

  it('reset: the next frame is iFrame 0 at iTime 0, and Feedback buffers are cleared', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.frame(1000, size);
    engine.frame(1016, size);
    engine.reset();
    engine.frame(1032, size);
    expect(fake.clears()).toBe(1);
    expect(fake.frames.at(-1)).toMatchObject({ frame: 0, time: 0 });
  });

  it('starts time over when the pass graph is rebuilt', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.frame(1000, size);
    engine.frame(1016, size);
    engine.setGraph(graph);
    engine.frame(1032, size);
    expect(fake.frames.at(-1)).toMatchObject({ frame: 0, time: 0 });
  });

  it('keeps time and buffers across a shader swap', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.frame(1000, size);
    engine.setShader('main', { source: '', lines: [], files: ['main.frag'] });
    engine.frame(1016, size);
    expect(fake.clears()).toBe(0);
    expect(fake.frames.at(-1)).toMatchObject({ frame: 1 });
  });
});
