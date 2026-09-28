import type { BufferSize, PassGraph } from '../sketch/graph';

/** A buffer's size in pixels: canvas × `scale` (rounded, at least 1×1), or its fixed `size`. */
export function bufferSize(size: BufferSize, canvasWidth: number, canvasHeight: number): [number, number] {
  if ('size' in size) return [size.size[0], size.size[1]];
  return [Math.max(1, Math.round(canvasWidth * size.scale)), Math.max(1, Math.round(canvasHeight * size.scale))];
}

/**
 * The size of every running Pass's output when the graph renders at `width × height`, in run
 * order (`main` last, at exactly that size). Used by the Output size re-render (#8 decision 5):
 * `scale` is taken relative to the Output size, and a fixed `size: [w, h]` stays as declared.
 */
export function graphBufferSizes(graph: PassGraph, width: number, height: number): [number, number][] {
  return graph.order.map((name) => bufferSize(graph.passes[name]!.buffer.size, width, height));
}

/**
 * Which of a Pass's buffers (slot 0 or 1) to write and read. A Pass with Feedback has two: each
 * frame it writes the one `prev()` isn't reading, so `prev()` sees last frame's output all frame
 * long while this frame's readers see the new one once the Pass has run. Without Feedback there
 * is one slot, reused every frame.
 */
export interface Slots {
  /** Call once at the start of every frame, before any Pass runs. */
  beginFrame(): void;
  /** The slot this frame's run writes. */
  write(): number;
  /** Call after the Pass has drawn into `write()`. */
  written(): void;
  /** The latest output: this frame's once the Pass has run. */
  current(): number;
  /** Last frame's output, for `prev()`. */
  previous(): number;
}

export function createSlots(feedback: boolean): Slots {
  let current = 0;
  let previous = 0;
  const write = () => (feedback ? 1 - previous : 0);
  return {
    beginFrame() {
      previous = current;
    },
    write,
    written() {
      current = write();
    },
    current: () => current,
    previous: () => previous,
  };
}
