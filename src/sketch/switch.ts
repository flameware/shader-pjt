import { sketchUrl } from './navigate';
import { pickSketch } from './pick';

/** The browser APIs a Sketch switch uses; `window` provides them, tests fake them. */
export interface SwitchPage {
  location: { readonly href: string; reload(): void };
  history: { replaceState(data: unknown, unused: string, url: string): void };
  /** `sessionStorage`, or `null` where it is unavailable. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  setTimeout(run: () => void, ms: number): void;
  /** Milliseconds, comparable across reloads (`Date.now`). */
  now(): number;
}

export interface OpenedSketch {
  /** `null` when there are no Sketches. */
  name: string | null;
  /** A toast to show on arrival: carried over from `go`, or why `?sketch` was not honoured. */
  notice: string | null;
}

export interface GoOptions {
  /** A toast for the page that opens the Sketch. */
  notice?: string;
  /**
   * `now` (default) reloads at once. `fallback` expects a reload that is already on its way (Vite's
   * full reload after a new Sketch folder) and reloads itself only if none comes within a second.
   */
  reload?: 'now' | 'fallback';
  /**
   * Work that must finish before this page reloads, such as saving a running Recording (#46). The
   * URL is rewritten first, so a reload that comes sooner still opens `name`; what it resolves to
   * is added to the notice.
   */
  waitFor?: Promise<string | null>;
}

/**
 * Which Sketch is open, and switching to another (#9 decisions 4, 9). The URL is the only state:
 * `?sketch=<name>`, rewritten with `history.replaceState` so reloading or sharing the link opens
 * the same Sketch and the back button isn't filled with Sketch hops.
 *
 * A switch rewrites the URL and reloads the page. Everything that belongs to one Sketch (pass
 * graph, programs, Parameter panel and values, hot-update routing) is then built fresh, and the
 * new Sketch starts at time 0 with empty Feedback — the same path a structural change to a
 * Sketch already takes (#17).
 */
export interface SketchSwitch {
  /** Picks the Sketch to open from `?sketch` and writes the choice back into the URL. */
  open(names: readonly string[]): OpenedSketch;
  /** Opens Sketch `name`: rewrites `?sketch` and reloads (see `GoOptions.reload`). */
  go(name: string, options?: GoOptions): void;
}

/** The real page. `sessionStorage` can throw (blocked storage); the notice is then dropped. */
export function browserSwitchPage(): SwitchPage {
  let storage: SwitchPage['storage'] = null;
  try {
    storage = window.sessionStorage;
  } catch {
    // No storage: switching still works, only the arrival toast is lost.
  }
  return { location, history, storage, setTimeout: (run, ms) => void window.setTimeout(run, ms), now: Date.now };
}

const NOTICE_KEY = 'shader-playground:sketch-notice';
/**
 * How long a carried notice stays showable. A new Sketch can cause more than one reload in a row
 * (Vite reloads once per glob that changed), so the notice isn't consumed by the first page.
 */
const NOTICE_MS = 3000;
const FALLBACK_RELOAD_MS = 1000;

export function createSketchSwitch(page: SwitchPage): SketchSwitch {
  const replaceUrl = (name: string) => {
    const url = sketchUrl(page.location.href, name);
    if (url !== page.location.href) page.history.replaceState(null, '', url);
  };
  const readNotice = (): string | null => {
    const stored = page.storage?.getItem(NOTICE_KEY) ?? null;
    if (stored === null) return null;
    try {
      const { text, until } = JSON.parse(stored) as { text: string; until: number };
      if (page.now() <= until) return text;
    } catch {
      // Unreadable: drop it.
    }
    page.storage?.removeItem(NOTICE_KEY);
    return null;
  };

  return {
    open(names) {
      const requested = new URL(page.location.href).searchParams.get('sketch');
      const name = pickSketch(names, requested);
      const carried = readNotice();
      if (name === null) return { name, notice: carried };
      replaceUrl(name);
      const missing = requested !== null && requested !== name ? `없는 Sketch: ${requested} · 가장 최근 Sketch를 엽니다` : null;
      return { name, notice: carried ?? missing };
    },

    go(name, { notice, reload = 'now', waitFor } = {}) {
      replaceUrl(name);
      const leave = (extra: string | null = null) => {
        const text = [notice, extra].filter((part) => part != null).join(' · ');
        try {
          if (text !== '') page.storage?.setItem(NOTICE_KEY, JSON.stringify({ text, until: page.now() + NOTICE_MS }));
        } catch {
          // Storage full or blocked: switch anyway, without the arrival toast.
        }
        if (reload === 'now') page.location.reload();
        else page.setTimeout(() => page.location.reload(), FALLBACK_RELOAD_MS);
      };
      if (waitFor === undefined) leave();
      else void waitFor.then(leave, () => leave());
    },
  };
}
