/**
 * The Sketch `step` places from `current` in `names` (sorted by name, as `sketchNames` returns
 * them): `[` is -1, `]` is +1. It wraps around at both ends, like the #9 prototype.
 */
export function neighbourSketch(names: readonly string[], current: string, step: 1 | -1): string {
  const index = names.indexOf(current);
  return names[(index + step + names.length) % names.length]!;
}

/** `href` with `?sketch=<name>` (#9 decision 9); other query parameters and the hash are kept. */
export function sketchUrl(href: string, name: string): string {
  const url = new URL(href);
  url.searchParams.set('sketch', name);
  return url.href;
}
