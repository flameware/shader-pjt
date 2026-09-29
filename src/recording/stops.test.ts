import { describe, expect, it } from 'vitest';
import { outputStop, recordingAvailability, renderSizeStop } from './stops';

describe('whether a Recording can start', () => {
  it('a preset Output size at fit is blocked, with the way out', () => {
    expect(recordingAvailability({ output: '4:5', renderScale: 'fit' })).toEqual({
      ok: false,
      reason: 'Output size로 녹화하려면 render scale을 full로 바꾸세요',
    });
  });

  it('a preset Output size at full records', () => {
    expect(recordingAvailability({ output: '4:5', renderScale: 'full' })).toEqual({ ok: true });
  });

  it('a custom [w, h] Output size follows the same rule as a preset', () => {
    expect(recordingAvailability({ output: [1200, 800], renderScale: 'fit' }).ok).toBe(false);
    expect(recordingAvailability({ output: [1200, 800], renderScale: 'full' }).ok).toBe(true);
  });

  it('window always records', () => {
    expect(recordingAvailability({ output: 'window', renderScale: 'fit' })).toEqual({ ok: true });
  });
});

describe('what ends a Recording early', () => {
  const started = { output: '4:5', renderScale: 'full' } as const;

  it('a new Output size ends it', () => {
    expect(outputStop(started, { output: '1:1', renderScale: 'full' })).toBe('output-size');
    expect(outputStop(started, { output: 'window', renderScale: 'fit' })).toBe('output-size');
  });

  it('a new render scale ends it', () => {
    expect(outputStop(started, { output: '4:5', renderScale: 'fit' })).toBe('render-scale');
  });

  it('the same Output size and render scale carries on, [w, h] compared by value', () => {
    expect(outputStop(started, { output: '4:5', renderScale: 'full' })).toBeNull();
    expect(outputStop({ output: [1200, 800], renderScale: 'full' }, { output: [1200, 800], renderScale: 'full' })).toBeNull();
  });

  it('a render size other than the one it started at ends it, by a single pixel too', () => {
    expect(renderSizeStop([1440, 900], [1440, 900])).toBeNull();
    expect(renderSizeStop([1440, 900], [1200, 900])).toBe('resize');
    // An odd side is cropped in the video, but the canvas still changed.
    expect(renderSizeStop([1440, 900], [1441, 900])).toBe('resize');
  });
});
