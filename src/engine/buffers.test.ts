import { describe, expect, it } from 'vitest';
import type { BufferSize, PassGraph, PassNode } from '../sketch/graph';
import { bufferSize, createSlots, graphBufferSizes } from './buffers';

describe('bufferSize', () => {
  it('follows the canvas by scale, rounding and never going below 1×1', () => {
    expect(bufferSize({ scale: 1 }, 1280, 720)).toEqual([1280, 720]);
    expect(bufferSize({ scale: 0.5 }, 1281, 721)).toEqual([641, 361]);
    expect(bufferSize({ scale: 0.001 }, 100, 100)).toEqual([1, 1]);
  });

  it('keeps a fixed size whatever the canvas is', () => {
    expect(bufferSize({ size: [256, 64] }, 1280, 720)).toEqual([256, 64]);
  });
});

describe('createSlots', () => {
  it('uses one slot for a Pass without Feedback: written and read in the same place every frame', () => {
    const slots = createSlots(false);
    for (let frame = 0; frame < 3; frame++) {
      slots.beginFrame();
      expect(slots.write()).toBe(0);
      slots.written();
      expect(slots.current()).toBe(0);
    }
  });

  it('with Feedback, writes the slot prev() is not reading, so a Pass can read its own last frame', () => {
    const slots = createSlots(true);
    slots.beginFrame();
    const first = slots.write();
    slots.written();

    slots.beginFrame();
    expect(slots.previous()).toBe(first);
    expect(slots.write()).not.toBe(first);
  });

  it('shows this frame’s output to readers after the Pass runs, and last frame’s to prev() all frame long', () => {
    const slots = createSlots(true);
    slots.beginFrame();
    slots.written();
    const lastFrame = slots.current();

    slots.beginFrame();
    const target = slots.write();
    slots.written();
    expect(slots.current()).toBe(target);
    expect(slots.previous()).toBe(lastFrame);
  });

  it('alternates between the two slots frame after frame', () => {
    const slots = createSlots(true);
    const written: number[] = [];
    for (let frame = 0; frame < 4; frame++) {
      slots.beginFrame();
      written.push(slots.write());
      slots.written();
    }
    expect(written).toEqual([1, 0, 1, 0]);
  });
});

describe('graphBufferSizes', () => {
  const node = (name: string, size: BufferSize): PassNode => ({
    name,
    file: `sketches/s/${name}.frag`,
    channels: [],
    buffer: { format: 'rgba16f', filter: 'linear', wrap: 'clamp', size },
    feedback: false,
  });
  const graph: PassGraph = {
    passes: {
      blur: node('blur', { scale: 0.5 }),
      lut: node('lut', { size: [256, 16] }),
      unused: node('unused', { scale: 4 }),
      main: node('main', { scale: 1 }),
    },
    order: ['blur', 'lut', 'main'],
    images: [],
  };

  it('recomputes scale against the size rendered at (the Output size, #24) and keeps a fixed size, for every Pass that runs', () => {
    expect(graphBufferSizes(graph, 2160, 2700)).toEqual([
      [1080, 1350],
      [256, 16],
      [2160, 2700],
    ]);
  });
});
