import { describe, expect, it } from 'vitest';
import { recordingHudView } from './recording-hud-view';

describe('recording HUD view', () => {
  it('shows video time as mm:ss and the frame count', () => {
    expect(recordingHudView(0)).toEqual({ time: '00:00', frames: '0 f' });
    expect(recordingHudView(59)).toEqual({ time: '00:00', frames: '59 f' });
    expect(recordingHudView(600)).toEqual({ time: '00:10', frames: '600 f' });
    expect(recordingHudView(3600)).toEqual({ time: '01:00', frames: '3600 f' });
  });
});
