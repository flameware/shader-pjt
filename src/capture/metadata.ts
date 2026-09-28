// Imports carry `.ts`: plugins/capture.ts loads this module into the Vite config too.
import type { OutputSize, RenderScale } from '../output/output-size.ts';
import type { ParamValue } from '../params/annotation.ts';
import type { Parameter, ParameterUniform } from '../params/values.ts';
import { iTXtChunk, insertBeforeImageData, tEXtChunk } from './png.ts';

/** `screen`: the frame as shown (`C`). `output`: the same moment at Output size (`Shift+C`, #24). */
export type CaptureKind = 'screen' | 'output';

/** The repo state the dev server records with a Capture. */
export interface GitState {
  commit: string;
  dirty: boolean;
}

/** The JSON in a Capture PNG's `shader-playground` iTXt chunk (#8 decision 12). */
export interface CaptureMetadata {
  v: 1;
  sketch: string;
  kind: CaptureKind;
  size: [number, number];
  output: OutputSize;
  /** As rendered: always `fit` for `window`. */
  renderScale: RenderScale;
  feedback: boolean;
  iTime: number;
  iFrame: number;
  iMouse: [number, number, number, number];
  params: Record<string, ParamValue>;
  /** Filled in by the dev server; missing when the Capture was saved as a download. */
  git?: GitState;
  /** Local time with offset (`localTimestamp`). */
  capturedAt: string;
}

/** The inputs a frame was drawn with (`FrameInputs` from the renderer fits). */
export interface CapturedFrame {
  time: number;
  frame: number;
  mouse: readonly [number, number, number, number];
  parameters?: readonly ParameterUniform[];
}

const hexByte = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, '0');

/** One uniform's data back in annotation notation. */
function toValue({ spec }: Parameter, data: readonly number[]): ParamValue | undefined {
  switch (spec.kind) {
    case 'float':
    case 'int':
      return data[0];
    case 'bool':
      return data[0] !== 0;
    case 'color':
      return `#${data.map(hexByte).join('')}`;
    case 'vec2':
      return [data[0]!, data[1]!];
    case 'select':
      return spec.options[data[0]!];
  }
}

/**
 * The Parameter values a frame was drawn with, in the notation of "현재 값 복사" and
 * `ParameterValues.snapshot()` (color hex, select name, vec2 `[x, y]`). Read back from the
 * uniforms rather than the store, because a paused Feedback Sketch shows a frame drawn before
 * any later Parameter change.
 */
export function parameterSnapshot(parameters: readonly Parameter[], uniforms: readonly ParameterUniform[]): Record<string, ParamValue> {
  const byName = new Map(parameters.map((p) => [p.name, p]));
  const snapshot: Record<string, ParamValue> = {};
  for (const { name, type, data } of uniforms) {
    const parameter = byName.get(name);
    // Declarations changed since that frame (a hot swap while paused): don't misread old data.
    const value = parameter?.type === type ? toValue(parameter, data) : undefined;
    if (value !== undefined) snapshot[name] = value;
  }
  return snapshot;
}

/** What `captureMetadata` describes. */
export interface CaptureMetadataInput {
  sketch: string;
  kind: CaptureKind;
  size: readonly [number, number];
  output: OutputSize;
  renderScale: RenderScale;
  feedback: boolean;
  /** The inputs the captured image was drawn with. */
  frame: CapturedFrame;
  /** The Parameter declarations, to read `frame.parameters` back into notation. */
  parameters: readonly Parameter[];
  capturedAt: string;
}

/** The metadata of one Capture, without `git` (the dev server adds it with `withGit`). */
export function captureMetadata(input: CaptureMetadataInput): CaptureMetadata {
  const { frame } = input;
  return {
    v: 1,
    sketch: input.sketch,
    kind: input.kind,
    size: [input.size[0], input.size[1]],
    output: input.output,
    renderScale: input.renderScale,
    feedback: input.feedback,
    iTime: frame.time,
    iFrame: frame.frame,
    iMouse: [...frame.mouse],
    params: parameterSnapshot(input.parameters, frame.parameters ?? []),
    capturedAt: input.capturedAt,
  };
}

/** The iTXt keyword the metadata JSON is stored under, and the `Software` tEXt value. */
export const METADATA_KEYWORD = 'shader-playground';

/** `png` with the metadata iTXt and `Software` tEXt chunks before its image data (#8 decision 12). */
export function embedMetadata(png: Uint8Array, meta: CaptureMetadata): Uint8Array {
  return insertBeforeImageData(png, [iTXtChunk(METADATA_KEYWORD, JSON.stringify(meta)), tEXtChunk('Software', METADATA_KEYWORD)]);
}

/** `meta` with `git` set, keeping the #8 field order (git just before capturedAt). */
export function withGit(meta: CaptureMetadata, git: GitState): CaptureMetadata {
  const { capturedAt, git: _old, ...rest } = meta;
  return { ...rest, git, capturedAt };
}
