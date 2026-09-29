// Imports carry `.ts`: plugins/recording.ts loads this module into the Vite config too.
import type { GitState } from '../capture/metadata.ts';
import type { OutputSize, RenderScale } from '../output/output-size.ts';
import type { ParamValue } from '../params/annotation.ts';
import { RECORDING_FPS } from './encoding.ts';

/** The sidecar JSON written next to a Recording's mp4 (#42 decision 12). */
export interface RecordingMetadata {
  v: 1;
  sketch: string;
  /** The video's frame size. */
  size: [number, number];
  output: OutputSize;
  /** As rendered: always `fit` for `window`. */
  renderScale: RenderScale;
  feedback: boolean;
  fps: number;
  frames: number;
  /** Seconds of video: `frames / fps`. */
  duration: number;
  /**
   * The Parameter values when the Recording started, in Capture's `params` notation; they may
   * have been changed live while it ran.
   */
  paramsAtStart: Record<string, ParamValue>;
  /** Filled in by the dev server; there is no sidecar when the mp4 is downloaded instead. */
  git?: GitState;
  /** When the Recording started: local time with offset (`localTimestamp`). */
  recordedAt: string;
}

/** What `recordingMetadata` describes. */
export interface RecordingMetadataInput {
  sketch: string;
  size: readonly [number, number];
  output: OutputSize;
  renderScale: RenderScale;
  feedback: boolean;
  frames: number;
  paramsAtStart: Record<string, ParamValue>;
  recordedAt: string;
}

/** The sidecar of one Recording, without `git` (the dev server adds it with `withGit`). */
export function recordingMetadata(input: RecordingMetadataInput): RecordingMetadata {
  return {
    v: 1,
    sketch: input.sketch,
    size: [input.size[0], input.size[1]],
    output: input.output,
    renderScale: input.renderScale,
    feedback: input.feedback,
    fps: RECORDING_FPS,
    frames: input.frames,
    duration: input.frames / RECORDING_FPS,
    paramsAtStart: input.paramsAtStart,
    recordedAt: input.recordedAt,
  };
}

/** `meta` with `git` set, keeping the #42 field order (git just before recordedAt). */
export function withGit(meta: RecordingMetadata, git: GitState): RecordingMetadata {
  const { recordedAt, git: _old, ...rest } = meta;
  return { ...rest, git, recordedAt };
}
