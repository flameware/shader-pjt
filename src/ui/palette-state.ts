/** Whether `needle`'s characters all appear in `haystack` in order, gaps allowed. */
function inOrder(haystack: string, needle: string): boolean {
  let at = 0;
  for (const char of needle) {
    at = haystack.indexOf(char, at) + 1;
    if (at === 0) return false;
  }
  return true;
}

/**
 * The Sketches matching `query`, newest first (names are dates, so reverse name order).
 * Case is ignored. A name matches plainly when it contains every space-separated word of the
 * query, and loosely when the query's letters appear in it in order with gaps (`fw` → `flow`).
 * Plain matches come first.
 */
export function filterSketches(names: readonly string[], query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const newestFirst = [...names].reverse();
  if (words.length === 0) return newestFirst;
  const plain: string[] = [];
  const loose: string[] = [];
  for (const name of newestFirst) {
    const lower = name.toLowerCase();
    if (words.every((word) => lower.includes(word))) plain.push(name);
    else if (inOrder(lower, words.join(''))) loose.push(name);
  }
  return [...plain, ...loose];
}

export interface PaletteView {
  items: { name: string; current: boolean }[];
  /** Index into `items`; -1 when nothing matches. */
  selected: number;
}

/**
 * What the palette shows and which row `Enter` picks, without the DOM. It opens on the current
 * Sketch; typing selects the best match, and clearing the query goes back to the current one.
 */
export interface PaletteState {
  view(): PaletteView;
  setQuery(query: string): void;
  /** `↑` is -1, `↓` is +1; the selection stops at the ends. */
  move(step: 1 | -1): void;
  /** Selects the row at `index` (hover or click). */
  select(index: number): void;
  /** The Sketch `Enter` opens, or `null` when nothing matches. */
  chosen(): string | null;
}

export function createPaletteState(names: readonly string[], current: string): PaletteState {
  let items: string[] = [];
  let selected = -1;
  const setQuery = (query: string) => {
    items = filterSketches(names, query);
    selected = query.trim() === '' ? Math.max(items.indexOf(current), 0) : 0;
    if (items.length === 0) selected = -1;
  };
  setQuery('');
  return {
    view: () => ({ items: items.map((name) => ({ name, current: name === current })), selected }),
    setQuery,
    move(step) {
      if (items.length > 0) selected = Math.min(Math.max(selected + step, 0), items.length - 1);
    },
    select(index) {
      if (index >= 0 && index < items.length) selected = index;
    },
    chosen: () => items[selected] ?? null,
  };
}
