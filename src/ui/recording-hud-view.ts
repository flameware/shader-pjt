import { RECORDING_FPS } from '../recording/encoding';

/** What the Recording indicator shows beside its red dot (#42 decision 13). */
export interface RecordingHudView {
  /** Video time so far, `mm:ss`: frames / 60, so a paused stretch doesn't count. */
  time: string;
  frames: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function recordingHudView(frames: number): RecordingHudView {
  const seconds = Math.floor(frames / RECORDING_FPS);
  return { time: `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`, frames: `${frames} f` };
}
