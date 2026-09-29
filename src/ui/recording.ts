import type { Pane } from 'tweakpane';
import { localTimestamp } from '../capture/file-name';
import type { ClockTick } from '../engine/clock';
import type { Engine } from '../engine/engine';
import { type VideoRecorder, startVideoRecorder } from '../recording/encoder';
import { videoSize } from '../recording/encoding';
import { SAFETY_LIMIT_S, recordingEnd } from '../recording/length';
import { type RecordingMetadataInput, recordingMetadata } from '../recording/metadata';
import { recordingSavedText, saveRecording } from '../recording/save';
import type { RecordingSettings } from '../recording/settings';
import type { BrowserUi } from './browser-ui';
import { type RecordingFolder, mountRecordingFolder } from './recording-folder';
import { mountRecordingIndicator } from './recording-indicator';

const TOAST_MS = 6000;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export interface RecordingOptions {
  sketch: string;
  canvas: HTMLCanvasElement;
  engine: Pick<Engine, 'setFixedStep'>;
  /** The panel the Recording folder joins, after Capture. */
  pane: Pane;
  /** The Sketch's max length (#45). */
  settings: RecordingSettings;
  /** What the sidecar JSON records about the Sketch, read when the Recording starts (#44). */
  describe(): RecordingDescription;
}

/** The Output size, (effective) render scale, Feedback and Parameter values a Recording starts with. */
export type RecordingDescription = Pick<RecordingMetadataInput, 'output' | 'renderScale' | 'feedback' | 'paramsAtStart'>;

export interface Recording {
  /**
   * Call first in every animation frame: `false` means the encoder is behind, so skip this
   * animation frame entirely (no `engine.frame`, so the clock doesn't advance either).
   */
  ready(): boolean;
  /** Call every animation frame right after `engine.frame`; encodes the frame if time advanced. */
  frame(tick: ClockTick): void;
  /** The panel's Recording folder; its `toggle` button can be disabled with a reason, as Capture's is. */
  folder: RecordingFolder;
}

type State =
  | { kind: 'idle' }
  /** Waiting for the encoder; `V` again cancels. */
  | { kind: 'starting'; cancelled: boolean }
  | { kind: 'recording'; recorder: VideoRecorder; startedAt: string; described: RecordingDescription };

/**
 * Recording (#43): `V` starts it and `V` again ends it and saves the mp4 (#44: under `captures/`
 * with a sidecar JSON, or as a download). While it runs the clock takes fixed 1/60 s steps (ADR-0006) and every frame whose time advanced becomes one video
 * frame, so a paused stretch is left out and a `.` step adds one frame.
 *
 * #45: the panel's Recording folder does the same as `V` and picks the max length; the Recording
 * ends on the exact frame that reaches it, or at the 60 s safety limit without one. A red dot
 * with the video time and frame count shows while it runs.
 */
export function mountRecording(ui: BrowserUi, options: RecordingOptions): Recording {
  const { canvas, engine } = options;
  let state: State = { kind: 'idle' };

  const start = async () => {
    const starting = { kind: 'starting' as const, cancelled: false };
    state = starting;
    let recorder: VideoRecorder | null = null;
    const onError = (error: Error) => {
      console.error('[recording] encoding failed', error);
      // Once stopped, the failure surfaces from `finish` instead.
      if (state.kind !== 'recording' || state.recorder !== recorder) return;
      recorder.cancel();
      state = { kind: 'idle' };
      engine.setFixedStep(false);
      ui.toasts.show(`Recording 실패: ${error.message}`, { durationMs: TOAST_MS });
    };
    const result = await startVideoRecorder([canvas.width, canvas.height], onError).catch(
      (error: unknown) => ({ ok: false, reason: `Recording을 시작하지 못했습니다: ${messageOf(error)}` }) as const,
    );
    if (starting.cancelled || !result.ok) {
      state = { kind: 'idle' };
      if (result.ok) result.recorder.cancel();
      else ui.toasts.show(result.reason, { durationMs: TOAST_MS });
      return;
    }
    recorder = result.recorder;
    state = { kind: 'recording', recorder, startedAt: localTimestamp(new Date()), described: options.describe() };
    engine.setFixedStep(true);
  };

  const stop = async () => {
    if (state.kind !== 'recording') return;
    const { recorder, startedAt, described } = state;
    state = { kind: 'idle' };
    engine.setFixedStep(false);
    if (recorder.frames() === 0) {
      recorder.cancel();
      return ui.toasts.show('녹화된 frame이 없어 저장하지 않았습니다');
    }
    try {
      const mp4 = await recorder.finish();
      const meta = recordingMetadata({ ...described, sketch: options.sketch, size: recorder.size, frames: recorder.frames(), recordedAt: startedAt });
      ui.toasts.show(recordingSavedText(await saveRecording(meta, mp4)), { durationMs: TOAST_MS });
    } catch (error) {
      console.error('[recording] saving failed', error);
      ui.toasts.show(`Recording 저장 실패: ${messageOf(error)}`, { durationMs: TOAST_MS });
    }
  };

  const toggle = () => {
    if (state.kind === 'idle') void start();
    else if (state.kind === 'starting') state.cancelled = true;
    else void stop();
  };
  ui.keymap.add({ keys: ['V'], description: 'Recording 시작 / 끝', run: toggle });
  const folder = mountRecordingFolder(options.pane, options.settings, toggle);
  const indicator = mountRecordingIndicator(document.body);

  /** Adds the frame on screen, then ends the Recording right there once it is long enough (#45). */
  const record = (recorder: VideoRecorder) => {
    recorder.addFrame(canvas);
    const end = recordingEnd(recorder.frames(), options.settings.maxLength());
    if (end === null) return;
    if (end === 'safety') ui.toasts.show(`안전 상한 ${SAFETY_LIMIT_S}초에 도달해 Recording을 끝냈습니다`, { durationMs: TOAST_MS });
    void stop();
  };

  const render = () => {
    folder.render(state.kind);
    indicator.render(state.kind === 'recording' ? state.recorder.frames() : null, ui.hud.state());
  };

  return {
    folder,

    ready: () => state.kind !== 'recording' || !state.recorder.busy(),

    frame(tick) {
      if (state.kind === 'recording' && tick.advanced) {
        const { recorder } = state;
        const [width, height] = videoSize([canvas.width, canvas.height]);
        // A new frame size can't go into the same video: end it with what was recorded so far.
        if (width !== recorder.size[0] || height !== recorder.size[1]) void stop();
        else record(recorder);
      }
      render();
    },
  };
}
