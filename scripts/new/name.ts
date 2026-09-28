/**
 * Naming a new Sketch folder (#12 decision 8): `YYYY-MM-DD[-slug]`, local date, `-2`, `-3`, …
 * when the name is taken.
 */

/**
 * The slug part of a Sketch name: lowercase, spaces and `_` become `-`, anything outside
 * `[a-z0-9-]` is dropped, runs of `-` collapse and leading/trailing `-` go. May be empty.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` in local time: UTC would give yesterday's date before 9 a.m. in Korea. */
function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The name for a new Sketch made at `now`: `YYYY-MM-DD[-slug]`, then `-2`, `-3`, … while `isTaken`. */
export function sketchName(now: Date, slug: string, isTaken: (name: string) => boolean): string {
  const base = slug === '' ? localDate(now) : `${localDate(now)}-${slug}`;
  let name = base;
  for (let n = 2; isTaken(name); n++) name = `${base}-${n}`;
  return name;
}
