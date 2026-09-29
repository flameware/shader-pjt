import type { HudState } from './hud-visibility';
import './recording.css';
import { recordingHudView } from './recording-hud-view';

/** The on-screen Recording indicator; `render` is called every animation frame. */
export interface RecordingIndicator {
  /** `frames` encoded so far while recording, `null` otherwise (hidden). */
  render(frames: number | null, hud: HudState): void;
}

/**
 * The red dot, video time (`mm:ss`) and frame count just above the play bar (#42 decision 13).
 * It is DOM, so it never gets into the video. It sits outside the HUD so it isn't hidden with it:
 * while the HUD is faded out or off (`H`) only the dot stays, so a running Recording can't be missed.
 */
export function mountRecordingIndicator(parent: HTMLElement): RecordingIndicator {
  const root = document.createElement('div');
  root.className = 'recording-indicator hud-glass';
  root.hidden = true;
  root.title = 'Recording 중 (V로 끝)';
  const dot = document.createElement('span');
  dot.className = 'recording-indicator-dot';
  const text = document.createElement('span');
  text.className = 'recording-indicator-text';
  root.append(dot, text);
  parent.append(root);

  return {
    render(frames, hud) {
      root.hidden = frames === null;
      if (frames === null) return;
      if (root.dataset.hud !== hud) root.dataset.hud = hud;
      const view = recordingHudView(frames);
      const next = `REC ${view.time} · ${view.frames}`;
      if (text.textContent !== next) text.textContent = next;
    },
  };
}
