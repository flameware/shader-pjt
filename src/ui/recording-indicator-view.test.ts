import { describe, expect, it } from 'vitest';
import { recordingIndicatorView } from './recording-indicator-view';

describe('recording indicator view', () => {
  it('shows video time as mm:ss and the frame count', () => {
    expect(recordingIndicatorView(0)).toEqual({ time: '00:00', frames: '0 f' });
    expect(recordingIndicatorView(59)).toEqual({ time: '00:00', frames: '59 f' });
    expect(recordingIndicatorView(600)).toEqual({ time: '00:10', frames: '600 f' });
    expect(recordingIndicatorView(3600)).toEqual({ time: '01:00', frames: '3600 f' });
  });
});
