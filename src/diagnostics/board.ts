import type { Diagnostic } from './diagnostic';

/**
 * The one path every problem takes to the banner. Each producer reports under its own key
 * (e.g. `compile:<file>`, later `include:<file>`, `graph`, `params`), and each report replaces
 * that key's previous list — so a producer clears its problems by reporting `[]`, and fixing
 * one problem never hides another producer's.
 */
export interface DiagnosticsBoard {
  report(source: string, diagnostics: readonly Diagnostic[]): void;
  /** Every current diagnostic, grouped by source in first-reported order. */
  all(): Diagnostic[];
  subscribe(listener: (all: Diagnostic[]) => void): () => void;
}

/** An empty board. The app keeps one and hands it to every producer. */
export function createDiagnosticsBoard(): DiagnosticsBoard {
  const bySource = new Map<string, readonly Diagnostic[]>();
  const listeners = new Set<(all: Diagnostic[]) => void>();
  const all = () => [...bySource.values()].flat();

  return {
    report(source, diagnostics) {
      if (diagnostics.length === 0) bySource.delete(source);
      else bySource.set(source, [...diagnostics]);
      const current = all();
      for (const listener of listeners) listener(current);
    },
    all,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
