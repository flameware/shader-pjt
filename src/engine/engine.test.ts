import { describe, expect, it } from 'vitest';
import type { PassGraph, PassNode } from '../sketch/graph';
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

const node = (name: string, feedback: boolean): PassNode => ({
  name,
  file: `sketches/s/${name}.frag`,
  channels: [],
  buffer: { format: 'rgba16f', filter: 'linear', wrap: 'clamp', size: { scale: 1 } },
  feedback,
});
const graph: PassGraph = { passes: { main: node('main', false) }, order: ['main'] };
const feedbackGraph: PassGraph = {
  passes: { trail: node('trail', true), main: node('main', false) },
  order: ['trail', 'main'],
};
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

  it('paused, a Sketch without Feedback keeps redrawing the same time and iFrame', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.setGraph(graph);
    engine.frame(1000, size);
    engine.frame(1016, size);
    engine.playback.setPaused(true);
    engine.frame(1032, size);
    engine.frame(1048, size);
    expect(fake.frames.map((f) => [f.frame, f.time])).toEqual([
      [0, 0],
      [1, 0.016],
      [1, 0.016],
      [1, 0.016],
    ]);
  });

  it('paused, a Feedback Sketch stops drawing; a step draws exactly one more frame', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.setGraph(feedbackGraph);
    engine.frame(1000, size);
    engine.playback.setPaused(true);
    engine.frame(1016, size);
    engine.frame(1032, size);
    engine.playback.step();
    engine.frame(1048, size);
    engine.frame(1064, size);
    expect(fake.frames.map((f) => f.frame)).toEqual([0, 1]);
  });

  it('reset while paused shows frame 0 of a Feedback Sketch once, then holds', () => {
    const fake = fakeRenderer();
    const engine = createEngine(fake.renderer, createClock());
    engine.setGraph(feedbackGraph);
    engine.frame(1000, size);
    engine.frame(1016, size);
    engine.playback.setPaused(true);
    engine.reset();
    engine.frame(1032, size);
    engine.frame(1048, size);
    expect(fake.frames.map((f) => f.frame)).toEqual([0, 1, 0]);
  });

  it('isFrozen: only a paused Feedback Sketch with no step pending holds its picture', () => {
    const engine = createEngine(fakeRenderer().renderer, createClock());
    engine.setGraph(feedbackGraph);
    engine.frame(1000, size);
    const states = [engine.isFrozen()];
    engine.playback.setPaused(true);
    states.push(engine.isFrozen());
    engine.playback.step();
    states.push(engine.isFrozen());
    engine.frame(1016, size);
    states.push(engine.isFrozen());
    engine.setGraph(graph);
    engine.frame(1032, size);
    states.push(engine.isFrozen());
    expect(states).toEqual([false, true, false, true, false]);
  });

  it('frame() reports the time it used, for the play bar', () => {
    const engine = createEngine(fakeRenderer().renderer, createClock());
    engine.frame(1000, size);
    expect(engine.frame(1020, size)).toMatchObject({ time: 0.02, frame: 1 });
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
