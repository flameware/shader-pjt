import { type OutputSize, type RenderScale, effectiveRenderScale, sameOutput } from '../output/output-size';

/**
 * When a Recording can't start, and what ends one early (#42 decisions 4, 6; ADR-0006). A video
 * keeps one frame size, and a Recording saves exactly what the engine renders.
 */

/** Whether `V` can start a Recording now, and if not, the reason for the tooltip and the toast. */
export type RecordingAvailability = { ok: true } | { ok: false; reason: string };

/**
 * A preset (or `[w, h]`) Output size records only at `full`, the same rule ADR-0001 sets for an
 * Output size Capture: at `fit` the engine renders the screen's pixels, not the Output size.
 * `window` always records its render size.
 */
export function recordingAvailability(input: { output: OutputSize; renderScale: RenderScale }): RecordingAvailability {
  if (input.output === 'window' || effectiveRenderScale(input.output, input.renderScale) === 'full') return { ok: true };
  return { ok: false, reason: 'Output size로 녹화하려면 render scale을 full로 바꾸세요' };
}

/**
 * Why a Recording ended early: every one changes the frame size, which can't change inside one
 * video, so the Recording ends and what was recorded so far is saved. Reset, hot reload, pause
 * and speed keep the frame size, so they never end one.
 */
export type RecordingStop = 'sketch' | 'output-size' | 'render-scale' | 'resize';

const STOP_TEXT: Record<RecordingStop, string> = {
  sketch: 'Sketch를 전환해 Recording을 끝내고 저장합니다',
  'output-size': 'Output size가 바뀌어 Recording을 끝내고 저장합니다',
  'render-scale': 'render scale이 바뀌어 Recording을 끝내고 저장합니다',
  resize: '창 크기가 바뀌어 Recording을 끝내고 저장합니다',
};

/** The toast that says why a Recording ended early. */
export const recordingStopText = (stop: RecordingStop) => STOP_TEXT[stop];

type OutputChoice = { output: OutputSize; renderScale: RenderScale };

/** Whether moving from the Output size and render scale a Recording started at to `now` ends it. */
export function outputStop(started: OutputChoice, now: OutputChoice): 'output-size' | 'render-scale' | null {
  if (!sameOutput(started.output, now.output)) return 'output-size';
  if (effectiveRenderScale(started.output, started.renderScale) !== effectiveRenderScale(now.output, now.renderScale)) return 'render-scale';
  return null;
}

/**
 * Whether the canvas's render size, compared with the one the Recording started at, ends it. In
 * `window` that is the browser window being resized; with a preset it only follows `outputStop`.
 */
export function renderSizeStop(started: readonly [number, number], now: readonly [number, number]): 'resize' | null {
  return started[0] === now[0] && started[1] === now[1] ? null : 'resize';
}
