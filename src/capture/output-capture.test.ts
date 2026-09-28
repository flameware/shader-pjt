import { describe, expect, it } from 'vitest';
import type { BufferSize, PassGraph, PassNode } from '../sketch/graph';
import { createClock } from '../engine/clock';
import { createEngine } from '../engine/engine';
import type { CaptureRenderer, FrameInputs, MainImage, OffscreenResult } from '../engine/renderer';
import {
  type OutputAvailability,
  outputCaptureAvailability,
  outputFrame,
  outputTargetSizes,
  scaleMouse,
  sizeLimitProblem,
  takeOutputCapture,
} from './output-capture';

describe('scaleMouse', () => {
  it('stretches xy and zw from the working resolution to the Output size', () => {
    expect(scaleMouse([100, 50, 40, 20], [400, 500], [2160, 2700])).toEqual([540, 270, 216, 108]);
  });

  it('keeps the signs that say the button is up and the click is old', () => {
    expect(scaleMouse([100, 50, -40, -20], [400, 500], [2160, 2700])).toEqual([540, 270, -216, -108]);
  });

  it('leaves an untouched mouse at 0', () => {
    expect(scaleMouse([0, 0, 0, 0], [400, 500], [2160, 2700])).toEqual([0, 0, 0, 0]);
  });
});

describe('outputFrame', () => {
  const shown: FrameInputs = {
    time: 12.345,
    timeDelta: 0.016,
    frame: 740,
    width: 432,
    height: 540,
    mouse: [216, 270, -108, -54],
    parameters: [{ name: 'speed', type: 'float', data: [1.2] }],
  };

  it('keeps the time, frame and Parameters of the frame on screen and draws at the Output size', () => {
    expect(outputFrame(shown, [2160, 2700])).toEqual({
      time: 12.345,
      timeDelta: 0.016,
      frame: 740,
      width: 2160,
      height: 2700,
      mouse: [1080, 1350, -540, -270],
      parameters: [{ name: 'speed', type: 'float', data: [1.2] }],
    });
  });

  it('is a copy: the frame on screen is not changed', () => {
    const before = structuredClone(shown);
    outputFrame(shown, [2160, 2700]);
    expect(shown).toEqual(before);
  });
});

describe('outputCaptureAvailability', () => {
  it('re-renders a Sketch without Feedback at the Output size, under fit or full', () => {
    for (const renderScale of ['fit', 'full'] as const) {
      expect(outputCaptureAvailability({ output: '4:5', renderScale, feedback: false })).toEqual({ ok: true, mode: 'rerender', size: [2160, 2700] });
    }
    expect(outputCaptureAvailability({ output: [640, 480], renderScale: 'fit', feedback: false })).toEqual({ ok: true, mode: 'rerender', size: [640, 480] });
  });

  it('saves a Feedback Sketch as shown, only while it renders at full Output size', () => {
    expect(outputCaptureAvailability({ output: '1:1', renderScale: 'full', feedback: true })).toEqual({ ok: true, mode: 'as-shown', size: [2160, 2160] });
    const fit = outputCaptureAvailability({ output: '1:1', renderScale: 'fit', feedback: true });
    expect(fit.ok).toBe(false);
    expect(!fit.ok && fit.reason).toMatch(/Feedback/);
    expect(!fit.ok && fit.reason).toMatch(/full/);
  });

  it('is not offered for window, with or without Feedback', () => {
    for (const feedback of [false, true]) {
      const result = outputCaptureAvailability({ output: 'window', renderScale: 'fit', feedback });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.reason).toMatch(/window/);
    }
  });
});

describe('outputTargetSizes', () => {
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
  };

  it('recomputes scale against the Output size and keeps a fixed size, for every Pass that runs', () => {
    expect(outputTargetSizes(graph, [2160, 2700])).toEqual([
      [1080, 1350],
      [256, 16],
      [2160, 2700],
    ]);
  });
});

describe('sizeLimitProblem', () => {
  const limits = { maxTextureSize: 4096, maxRenderbufferSize: 8192, maxViewportDims: [8192, 3000] as const };

  it('passes sizes within every limit', () => {
    expect(sizeLimitProblem([[4096, 3000], [16, 16]], limits)).toBeNull();
  });

  it('names the size and the limit it exceeds', () => {
    expect(sizeLimitProblem([[4097, 100]], limits)).toMatch(/4097×100.*MAX_TEXTURE_SIZE 4096/);
    expect(sizeLimitProblem([[100, 3001]], limits)).toMatch(/100×3001.*MAX_VIEWPORT_DIMS 8192×3000/);
    expect(sizeLimitProblem([[100, 100]], { ...limits, maxRenderbufferSize: 64 })).toMatch(/MAX_RENDERBUFFER_SIZE 64/);
  });
});

describe('takeOutputCapture', () => {
  const rerender: OutputAvailability = { ok: true, mode: 'rerender', size: [2160, 2700] };
  const pixels = (frame: FrameInputs): OffscreenResult => ({ ok: true, width: frame.width, height: frame.height, pixels: new Uint8Array(4) });

  /** A renderer stand-in: remembers the frames it draws, like the real one. */
  function fakeRenderer(render: (frame: FrameInputs) => OffscreenResult = pixels) {
    let drawn: FrameInputs | null = null;
    const rendered: FrameInputs[] = [];
    const renderer = {
      setShader: () => ({ ok: true }) as const,
      setGraph: () => {},
      isRunning: () => true,
      clearBuffers: () => {},
      draw: (frame: FrameInputs) => void (drawn = frame),
      readMain: (): MainImage | null => null,
      lastFrame: () => drawn,
      renderOffscreen: (frame: FrameInputs) => (rendered.push(frame), render(frame)),
    } satisfies CaptureRenderer;
    return { renderer, rendered };
  }

  const size = { width: 432, height: 540, mouse: [216, 270, -108, -54] as const, parameters: [{ name: 'speed', type: 'float' as const, data: [2] }] };

  it('re-renders the frame on screen, taken before the next frame advances time', () => {
    const { renderer, rendered } = fakeRenderer();
    const engine = createEngine(renderer, createClock());
    engine.frame(0, size);
    engine.frame(16, size);
    const shown = renderer.lastFrame()!;

    // The key was pressed; the next animation frame takes the Capture before `engine.frame`.
    const result = takeOutputCapture(rerender, renderer);
    engine.frame(32, size);

    expect(result).toMatchObject({ ok: true, frame: { time: shown.time, timeDelta: shown.timeDelta, frame: 1, width: 2160, height: 2700 } });
    expect(rendered).toHaveLength(1);
    expect(rendered[0]!.mouse).toEqual([1080, 1350, -540, -270]);
    expect(rendered[0]!.parameters).toEqual([{ name: 'speed', type: 'float', data: [2] }]);
  });

  it('works the same while paused', () => {
    const { renderer } = fakeRenderer();
    const engine = createEngine(renderer, createClock());
    engine.frame(0, size);
    engine.frame(16, size);
    engine.playback.setPaused(true);
    engine.frame(500, { ...size, parameters: [{ name: 'speed', type: 'float', data: [3] }] });

    const result = takeOutputCapture(rerender, renderer);
    expect(result).toMatchObject({ ok: true, frame: { time: 0.016, timeDelta: 0, frame: 1, parameters: [{ name: 'speed', data: [3] }] } });
  });

  it('returns the image the off-screen run read back', () => {
    const { renderer } = fakeRenderer();
    renderer.draw({ time: 1, timeDelta: 0, frame: 3, ...size });
    const result = takeOutputCapture(rerender, renderer);
    expect(result.ok && result.image).toEqual({ width: 2160, height: 2700, pixels: new Uint8Array(4) });
  });

  it('passes an off-screen failure on as an error', () => {
    const { renderer } = fakeRenderer(() => ({ ok: false, error: 'GPU 메모리가 모자랍니다 (OUT_OF_MEMORY)' }));
    renderer.draw({ time: 1, timeDelta: 0, frame: 3, ...size });
    expect(takeOutputCapture(rerender, renderer)).toEqual({ ok: false, problem: 'error', message: 'GPU 메모리가 모자랍니다 (OUT_OF_MEMORY)' });
  });

  it('has nothing to capture before a frame is drawn', () => {
    const { renderer, rendered } = fakeRenderer();
    expect(takeOutputCapture(rerender, renderer)).toMatchObject({ ok: false, problem: 'no-frame' });
    expect(rendered).toHaveLength(0);
  });

  it('says why when Output size Capture is unavailable, without rendering', () => {
    const { renderer, rendered } = fakeRenderer();
    renderer.draw({ time: 1, timeDelta: 0, frame: 3, ...size });
    expect(takeOutputCapture({ ok: false, reason: 'window라서' }, renderer)).toEqual({ ok: false, problem: 'unavailable', message: 'window라서' });
    expect(rendered).toHaveLength(0);
  });

  describe('a Feedback Sketch under full', () => {
    const asShown: OutputAvailability = { ok: true, mode: 'as-shown', size: [2160, 2160] };
    const shownFrame: FrameInputs = { time: 4, timeDelta: 0.02, frame: 200, width: 2160, height: 2160, mouse: [10, 20, -10, -20] };

    it('saves the frame on screen as it is, without re-rendering', () => {
      const { renderer, rendered } = fakeRenderer();
      const image: MainImage = { width: 2160, height: 2160, pixels: new Uint8Array(4), frame: shownFrame, feedback: true };
      renderer.readMain = () => image;
      const result = takeOutputCapture(asShown, renderer);
      expect(result).toEqual({ ok: true, image, frame: shownFrame });
      expect(rendered).toHaveLength(0);
    });

    it('waits when the frame on screen is not at the Output size yet', () => {
      const { renderer } = fakeRenderer();
      renderer.readMain = () => ({ width: 800, height: 800, pixels: new Uint8Array(4), frame: shownFrame, feedback: true });
      expect(takeOutputCapture(asShown, renderer)).toMatchObject({ ok: false, problem: 'no-frame' });
    });
  });
});
