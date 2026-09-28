import type { Diagnostic } from '../diagnostics/diagnostic';
import type { ShaderSource } from '../shader-source';
import { type Declaration, type DeclarationsResult, findDeclarations } from './declarations';
import { mergeDeclarations } from './merge';

export type CompileOutcome = { ok: true } | { ok: false; diagnostics: Diagnostic[] };

export interface PassPipelineOptions {
  /** Pass name → its `.frag` path (the diagnostics keys use it). */
  passFiles: Record<string, string>;
  /** Pass names in GUI order (see `parameterPassOrder`). */
  order: readonly string[];
  /** Swaps the Pass's program if `shader` compiles. */
  compile(pass: string, shader: ShaderSource): CompileOutcome;
  /** Diagnostics board `report`, keyed `include:<file>`, `param:<file>`, `compile:<file>`. */
  report(key: string, diagnostics: readonly Diagnostic[]): void;
  /**
   * The Sketch's Parameters, from the declarations of the versions now running. `complete` is
   * true when every Pass runs its latest source, so a missing declaration is really gone.
   */
  onParameters(parameters: readonly Declaration[], options: { complete: boolean }): void;
}

export interface PassPipeline {
  /** New sources for some Passes: all of them on load, one per hot update. */
  update(entries: readonly (readonly [string, ShaderSource])[]): void;
}

interface PassState {
  /** The latest source received. */
  latest: ShaderSource;
  checked: DeclarationsResult | null;
  /** The last source handed to `compile` (whatever the outcome), so a failure isn't retried. */
  tried?: ShaderSource;
  /** The running version and its declarations. */
  running?: { shader: ShaderSource; declarations: Declaration[] };
}

/**
 * The path from a Pass's new source to the screen: include errors, then Parameter declarations
 * (per Pass, then across Passes), then compilation. Any error keeps the last good version of that
 * Pass running (#6 decision 4). Across Passes, conflicting declarations block every side; once
 * one side is fixed, every Pass whose latest source is now clean is built, including ones that
 * were waiting on the conflict.
 */
export function createPassPipeline(options: PassPipelineOptions): PassPipeline {
  const { passFiles, order, compile, report, onParameters } = options;
  const states = new Map<string, PassState>();
  const inOrder = () => order.filter((pass) => states.has(pass)).map((pass) => [pass, states.get(pass)!] as const);

  return {
    update(entries) {
      for (const [pass, shader] of entries) {
        const previous = states.get(pass);
        const checked = shader.resolveErrors?.length ? null : findDeclarations(shader);
        states.set(pass, { ...previous, latest: shader, checked });
      }

      // A Pass whose includes don't resolve is checked against the declarations it still runs.
      const { conflicts } = mergeDeclarations(
        inOrder().map(([pass, state]) => ({
          pass,
          declarations: state.checked?.declarations ?? state.running?.declarations ?? [],
        })),
      );

      for (const [pass, state] of inOrder()) {
        const file = passFiles[pass]!;
        const resolveErrors = state.latest.resolveErrors ?? [];
        const paramProblems = [...(state.checked?.diagnostics ?? []), ...(conflicts[pass] ?? [])];
        const blocked = resolveErrors.length > 0 || paramProblems.some((d) => d.severity === 'error');
        if (!blocked && state.tried !== state.latest) {
          state.tried = state.latest;
          const outcome = compile(pass, state.latest);
          if (outcome.ok) state.running = { shader: state.latest, declarations: state.checked!.declarations };
          report(`compile:${file}`, outcome.ok ? [] : outcome.diagnostics);
        } else if (blocked) {
          // Its compile errors (if any) belonged to an older version.
          report(`compile:${file}`, []);
        }
        report(`include:${file}`, resolveErrors);
        report(`param:${file}`, paramProblems);
      }

      // Running versions normally agree. If they don't (a Pass whose newer version is blocked
      // still runs an old declaration), the first one is shown and the renderer skips uploading
      // to a uniform of another type, rather than the Parameter vanishing from the GUI.
      const parameters: Declaration[] = [];
      for (const [, state] of inOrder()) {
        for (const declaration of state.running?.declarations ?? []) {
          if (!parameters.some((p) => p.name === declaration.name)) parameters.push(declaration);
        }
      }
      const complete = order.every((pass) => {
        const state = states.get(pass);
        return state?.running !== undefined && state.running.shader === state.latest;
      });
      onParameters(parameters, { complete });
    },
  };
}
