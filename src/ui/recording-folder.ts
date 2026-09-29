import type { ButtonApi, Pane } from 'tweakpane';
import { MAX_LENGTHS, type MaxLength, maxLengthLabel } from '../recording/length';
import type { RecordingSettings } from '../recording/settings';

/** Where a Recording is, as far as the panel cares. */
export type RecordingPhase = 'idle' | 'starting' | 'recording';

export interface RecordingFolder {
  /** Start / end (`V`). */
  toggle: ButtonApi;
  /**
   * Call every animation frame; the button title follows the phase. `blocked` is why a Recording
   * can't start now (`fit` at a preset, #46): the idle button is then disabled with it as tooltip, as Capture's is.
   */
  render(phase: RecordingPhase, blocked: string | null): void;
}

const TITLES: Record<RecordingPhase, string> = {
  idle: '● 녹화 시작',
  starting: '● 시작 중…',
  recording: '■ 녹화 끝',
};

const IDLE_TOOLTIP = 'Recording 시작 / 끝 (V)';

const lengthKey = (length: MaxLength) => (length === null ? 'none' : String(length));

/**
 * The panel's **Recording** folder, right after Capture (#42 decision 2): start / end and the
 * max length (없음 / 5 / 10 / 15 / 30초), kept per Sketch. It joins the Parameter panel's Pane,
 * whose click handler already blurs its buttons (Space stays pause).
 */
export function mountRecordingFolder(pane: Pane, settings: RecordingSettings, toggle: () => void): RecordingFolder {
  const folder = pane.addFolder({ title: 'Recording' });
  const button = folder.addButton({ title: TITLES.idle, label: 'V' });
  button.on('click', toggle);
  // Tweakpane compares list values with ===, so the dropdown works on string keys.
  const state = {
    get maxLength() {
      return lengthKey(settings.maxLength());
    },
    set maxLength(key: string) {
      const choice = MAX_LENGTHS.find((m) => lengthKey(m) === key);
      if (choice !== undefined) settings.setMaxLength(choice);
    },
  };
  folder.addBinding(state, 'maxLength', {
    label: '최대 길이',
    options: Object.fromEntries(MAX_LENGTHS.map((m) => [maxLengthLabel(m), lengthKey(m)])),
  });
  settings.subscribe(() => pane.refresh());

  button.element.title = IDLE_TOOLTIP;
  let shown: RecordingPhase = 'idle';
  let shownBlocked: string | null = null;
  return {
    toggle: button,
    render(phase, blocked) {
      // Only starting is blocked: a running Recording can always be ended.
      const reason = phase === 'idle' ? blocked : null;
      if (phase === shown && reason === shownBlocked) return;
      shown = phase;
      shownBlocked = reason;
      button.title = TITLES[phase];
      button.disabled = reason !== null;
      button.element.title = reason ?? IDLE_TOOLTIP;
    },
  };
}
