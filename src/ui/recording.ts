import type { Pane } from 'tweakpane';
import { localTimestamp } from '../capture/file-name';
import type { ClockTick } from '../engine/clock';
import type { Engine } from '../engine/engine';
import type { OutputSettings } from '../output/settings';
import { type VideoRecorder, startVideoRecorder } from '../recording/encoder';
import { SAFETY_LIMIT_S, recordingEnd } from '../recording/length';
import { type RecordingMetadataInput, recordingMetadata } from '../recording/metadata';
import { recordingSavedText, saveRecording } from '../recording/save';
import type { RecordingSettings } from '../recording/settings';
import { type RecordingStop, outputStop, recordingAvailability, recordingStopText, renderSizeStop } from '../recording/stops';
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
  /** Output size and render scale: `fit` at a preset blocks starting, and a change ends a Recording (#46). */
  output: Pick<OutputSettings, 'output' | 'renderScale' | 'subscribe'>;
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
  /**
   * Ends a running Recording (or cancels one still starting) for `reason`, telling why in a toast,
   * and resolves once it is saved, with the toast that says where. Also waits for a save already
   * under way, so a Sketch switch can go right after (#46).
   */
  stop(reason: RecordingStop): Promise<string | null>;
  /** The panel's Recording folder. */
  folder: RecordingFolder;
}

type State =
  | { kind: 'idle' }
  /** Waiting for the encoder; `V` again cancels. */
  | { kind: 'starting'; cancelled: boolean }
  | {
      kind: 'recording';
      recorder: VideoRecorder;
      /** The canvas's render size the video was set up for; a new one ends the Recording (#46). */
      renderSize: readonly [number, number];
      startedAt: string;
      described: RecordingDescription;
    };

/**
 * Recording (#43): `V` starts it and `V` again ends it and saves the mp4 (#44: under `captures/`
 * with a sidecar JSON, or as a download). While it runs the clock takes fixed 1/60 s steps (ADR-0006) and every frame whose time advanced becomes one video
 * frame, so a paused stretch is left out and a `.` step adds one frame.
 *
 * #45: the panel's Recording folder does the same as `V` and picks the max length; the Recording
 * ends on the exact frame that reaches it, or at the 60 s safety limit without one. A red dot
 * with the video time and frame count shows while it runs.
 *
 * #46: at a preset Output size it only starts under `full` (ADR-0006). Anything that changes the
 * frame size (Sketch switch, Output size, render scale, the window in `window`) ends it and saves
 * what was recorded, with the reason in a toast. Reset, hot reload, pause and speed carry on.
 * Leaving the page while it runs or saves asks first.
 */
export function mountRecording(ui: BrowserUi, options: RecordingOptions): Recording {
  const { canvas, engine, output } = options;
  let state: State = { kind: 'idle' };
  /** A Sketch switch is under way: no new Recording starts on a page about to reload. */
  let leaving = false;
  /** Saves under way; the page shouldn't be left before they finish. */
  const saving = new Set<Promise<string | null>>();
  const availability = () => recordingAvailability({ output: output.output(), renderScale: output.renderScale() });

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
    const renderSize = [canvas.width, canvas.height] as const;
    const result = await startVideoRecorder(renderSize, onError).catch(
      (error: unknown) => ({ ok: false, reason: `Recording을 시작하지 못했습니다: ${messageOf(error)}` }) as const,
    );
    if (starting.cancelled || !result.ok) {
      state = { kind: 'idle' };
      if (result.ok) result.recorder.cancel();
      else ui.toasts.show(result.reason, { durationMs: TOAST_MS });
      return;
    }
    recorder = result.recorder;
    state = { kind: 'recording', recorder, renderSize, startedAt: localTimestamp(new Date()), described: options.describe() };
    engine.setFixedStep(true);
  };

  /** Ends the Recording and saves it; resolves with the toast shown (or `null` when nothing ran). */
  const save = async (recording: Extract<State, { kind: 'recording' }>): Promise<string | null> => {
    const { recorder, startedAt, described } = recording;
    if (recorder.frames() === 0) {
      recorder.cancel();
      const text = '녹화된 frame이 없어 저장하지 않았습니다';
      ui.toasts.show(text);
      return text;
    }
    let text: string;
    try {
      const mp4 = await recorder.finish();
      const meta = recordingMetadata({ ...described, sketch: options.sketch, size: recorder.size, frames: recorder.frames(), recordedAt: startedAt });
      text = recordingSavedText(await saveRecording(meta, mp4));
    } catch (error) {
      console.error('[recording] saving failed', error);
      text = `Recording 저장 실패: ${messageOf(error)}`;
    }
    ui.toasts.show(text, { durationMs: TOAST_MS });
    return text;
  };

  /** Ends a running Recording, first telling why when `reason` says it ended early. */
  const stop = (reason?: RecordingStop): Promise<string | null> => {
    if (reason === 'sketch') leaving = true;
    if (state.kind === 'starting') {
      state.cancelled = true;
      return Promise.resolve(null);
    }
    if (state.kind !== 'recording') return Promise.all(saving).then((texts) => texts.at(-1) ?? null);
    const recording = state;
    state = { kind: 'idle' };
    engine.setFixedStep(false);
    if (reason !== undefined) ui.toasts.show(recordingStopText(reason), { durationMs: TOAST_MS });
    const saved = save(recording);
    saving.add(saved);
    void saved.finally(() => saving.delete(saved));
    return saved;
  };

  const toggle = () => {
    if (state.kind !== 'idle') return void stop();
    if (leaving) return;
    const current = availability();
    // The button is disabled then; `V` gives the same reason as its tooltip.
    if (!current.ok) return ui.toasts.show(current.reason);
    void start();
  };
  ui.keymap.add({ keys: ['V'], description: 'Recording 시작 / 끝', run: toggle });
  const folder = mountRecordingFolder(options.pane, options.settings, toggle);
  const indicator = mountRecordingIndicator(document.body);

  // Any Output size or render scale change resizes the frame: end the Recording (or a start that
  // would come up at the old size) before the next frame is drawn at the new one.
  output.subscribe(() => {
    if (state.kind === 'starting') return void stop();
    if (state.kind !== 'recording') return;
    const reason = outputStop(state.described, { output: output.output(), renderScale: output.renderScale() });
    if (reason !== null) void stop(reason);
  });
  window.addEventListener('beforeunload', (event) => {
    if (state.kind !== 'recording' && saving.size === 0) return;
    event.preventDefault();
    event.returnValue = ''; // older browsers only ask when this is set
  });

  /** Adds the frame on screen, then ends the Recording right there once it is long enough (#45). */
  const record = (recorder: VideoRecorder) => {
    recorder.addFrame(canvas);
    const end = recordingEnd(recorder.frames(), options.settings.maxLength());
    if (end === null) return;
    if (end === 'safety') ui.toasts.show(`안전 상한 ${SAFETY_LIMIT_S}초에 도달해 Recording을 끝냈습니다`, { durationMs: TOAST_MS });
    void stop();
  };

  const render = () => {
    const current = availability();
    folder.render(state.kind, current.ok ? null : current.reason);
    indicator.render(state.kind === 'recording' ? state.recorder.frames() : null, ui.hud.state());
  };

  return {
    folder,

    stop,

    ready: () => state.kind !== 'recording' || !state.recorder.busy(),

    frame(tick) {
      if (state.kind === 'recording') {
        // A new render size (the window, in `window`) can't go into the same video: end it with
        // what was recorded so far. Checked even while paused (a frozen Feedback Sketch's canvas
        // only resizes on play, so it ends then).
        const reason = renderSizeStop(state.renderSize, [canvas.width, canvas.height]);
        if (reason !== null) void stop(reason);
        else if (tick.advanced) record(state.recorder);
      }
      render();
    },
  };
}
