const MAIN_PASS_PATH = /\/sketches\/([^/]+)\/main\.frag$/;

/** Sketch names from the paths of their `main.frag` files, sorted by name (= by date). */
export function sketchNames(mainPassPaths: readonly string[]): string[] {
  return mainPassPaths
    .map((path) => MAIN_PASS_PATH.exec(path)?.[1])
    .filter((name): name is string => name !== undefined)
    .sort();
}

/**
 * The Sketch to open: the requested one if it exists, otherwise the latest (last by name).
 * `names` must be sorted, as `sketchNames` returns them.
 */
export function pickSketch(names: readonly string[], requested: string | null): string | null {
  if (requested !== null && names.includes(requested)) return requested;
  return names.at(-1) ?? null;
}
