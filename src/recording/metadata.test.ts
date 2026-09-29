import { describe, expect, it } from 'vitest';
import { recordingMetadata, withGit } from './metadata';

const input = {
  sketch: 'flow',
  size: [2160, 2700] as const,
  output: '4:5' as const,
  renderScale: 'full' as const,
  feedback: true,
  frames: 600,
  paramsAtStart: { speed: 0.5, tint: '#ff8800', mode: 'waves' },
  recordedAt: '2026-09-28T21:30:45+09:00',
};
const meta = recordingMetadata(input);

describe('recordingMetadata', () => {
  it('describes a Recording as the sidecar JSON: 60 fps, its length from the frame count', () => {
    expect(meta).toEqual({
      v: 1,
      sketch: 'flow',
      size: [2160, 2700],
      output: '4:5',
      renderScale: 'full',
      feedback: true,
      fps: 60,
      frames: 600,
      duration: 10,
      paramsAtStart: { speed: 0.5, tint: '#ff8800', mode: 'waves' },
      recordedAt: '2026-09-28T21:30:45+09:00',
    });
  });

  it('gives a partial second as a fraction', () => {
    expect(recordingMetadata({ ...input, frames: 90 }).duration).toBe(1.5);
  });
});

describe('withGit', () => {
  it('adds the git state just before recordedAt', () => {
    const withState = withGit(meta, { commit: 'abc1234', dirty: true });
    expect(withState.git).toEqual({ commit: 'abc1234', dirty: true });
    expect(Object.keys(withState).slice(-2)).toEqual(['git', 'recordedAt']);
  });
});
