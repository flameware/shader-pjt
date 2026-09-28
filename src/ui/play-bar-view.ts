import { playbackTitle } from './playback-actions';

/** What the play bar shows, gathered once per frame. */
export interface PlayBarState {
  paused: boolean;
  speed: number;
  /** `iTime` of the frame on screen, seconds. */
  time: number;
  /** `iFrame` of the frame on screen. */
  frame: number;
  /** How often the page draws, frames per second. */
  fps: number;
}

/** The text the play bar shows (#9 decision 6). */
export interface PlayBarView {
  toggle: string;
  toggleTitle: string;
  speed: string;
  clock: string;
}

export function playBarView({ paused, speed, time, frame, fps }: PlayBarState): PlayBarView {
  return {
    toggle: paused ? '▶' : '⏸',
    toggleTitle: playbackTitle('togglePause', paused ? '재생' : '일시정지'),
    speed: `${speed}×`,
    clock: `t ${time.toFixed(2)}s · f ${Math.max(frame, 0)} · ${Math.round(fps)} fps`,
  };
}
