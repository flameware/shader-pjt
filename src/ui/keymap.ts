/**
 * The one place keyboard shortcuts are registered (#9 decision 10). Features add their keys
 * here (playback and HUD now; Capture, the Sketch palette and `[`/`]` later), and the shortcut
 * table (`?`) lists whatever is registered.
 *
 * Key names: a letter (`R`, case-insensitive), `Shift+` a letter (`Shift+C`), the character a
 * symbol key types (`?`, `=`, `[`; Shift is whatever it took to type it), `Space`, `Escape`, or
 * `Mod+` any of these for ⌘ on macOS / Ctrl elsewhere (`Mod+K`). Alt combinations are left to
 * the browser (on macOS, Option changes the character anyway).
 *
 * Letters also work with a non-Latin input source active (e.g. the Korean 2-set layout types
 * `ㄱ` for R): then the physical key (`KeyR`) decides.
 */
export interface KeyBinding {
  /** Every key that triggers it; the shortcut table shows them all. */
  keys: string[];
  /** One line for the shortcut table. */
  description: string;
  run(): void;
  /** Whether holding the key down repeats it (default: no, e.g. so Space doesn't flicker). */
  repeat?: boolean;
}

/** The parts of a `KeyboardEvent` the keymap reads. */
export interface KeyInput {
  key: string;
  /** The physical key, e.g. `KeyR`. */
  code: string;
  /** True while an IME is composing; such keys belong to the IME. */
  isComposing: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat: boolean;
  target: unknown;
}

/** The shortcut registry; `mountBrowserUi` feeds it every `keydown`. */
export interface Keymap {
  /** Registers a binding; returns a function that removes it. Throws if a key is already bound. */
  add(binding: KeyBinding): () => void;
  /** Runs the binding for this key press, if any. True means handled (call `preventDefault`). */
  handle(input: KeyInput): boolean;
  /** Everything registered, in order. */
  bindings(): readonly KeyBinding[];
}

/** How a key name reads in the shortcut table: `Mod+K` is `⌘K` on macOS and `Ctrl+K` elsewhere. */
export function keyLabel(name: string, mac: boolean): string {
  return name.replace(/^Mod\+/, mac ? '⌘' : 'Ctrl+');
}

const isLetter = (key: string) => /^[a-z]$/i.test(key);

function canonical(key: string, mod: boolean, shift: boolean): string {
  const name = key === ' ' ? 'Space' : isLetter(key) ? key.toUpperCase() : key;
  // Shift is part of a letter's identity only; a symbol is named by what it types.
  const withShift = shift && isLetter(key);
  return `${mod ? 'Mod+' : ''}${withShift ? 'Shift+' : ''}${name}`;
}

function parse(name: string): string {
  const match = /^((?:(?:Mod|Shift)\+)*)(.+)$/.exec(name);
  if (!match) throw new Error(`알 수 없는 단축키 이름: ${name}`);
  const [, prefix = '', key = ''] = match;
  const shift = prefix.includes('Shift+');
  if (shift && !isLetter(key)) throw new Error(`Shift+는 글자 키에만 씁니다 (기호는 입력되는 글자로): ${name}`);
  return canonical(key === 'Space' ? ' ' : key, prefix.includes('Mod+'), shift);
}

/** The character the keymap goes by: the typed Latin letter or symbol, else the physical letter key. */
function typedKey({ key, code }: KeyInput): string {
  if (isLetter(key) || key.length !== 1) return key;
  const physical = /^Key([A-Z])$/.exec(code);
  return physical && !/[\x20-\x7e]/.test(key) ? physical[1]! : key;
}

/** Typing into these must never trigger a shortcut (palette, Tweakpane number inputs, …). */
function isTextEntry(target: unknown): boolean {
  if (typeof target !== 'object' || target === null) return false;
  const { tagName, isContentEditable } = target as { tagName?: unknown; isContentEditable?: unknown };
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || isContentEditable === true;
}

export function createKeymap(): Keymap {
  const byKey = new Map<string, KeyBinding>();
  const list: KeyBinding[] = [];

  return {
    add(binding) {
      const ids = binding.keys.map(parse);
      for (const id of ids) {
        const taken = byKey.get(id);
        if (taken) throw new Error(`단축키 ${id}는 이미 "${taken.description}"에 쓰이고 있습니다.`);
      }
      for (const id of ids) byKey.set(id, binding);
      list.push(binding);
      return () => {
        for (const id of ids) if (byKey.get(id) === binding) byKey.delete(id);
        const index = list.indexOf(binding);
        if (index >= 0) list.splice(index, 1);
      };
    },

    handle(input) {
      if (input.isComposing || input.altKey || isTextEntry(input.target)) return false;
      const id = canonical(typedKey(input), input.metaKey || input.ctrlKey, input.shiftKey);
      const binding = byKey.get(id);
      if (!binding) return false;
      // A held-down key is still swallowed, so it can't reach a focused button either.
      if (!input.repeat || binding.repeat) binding.run();
      return true;
    },

    bindings: () => list,
  };
}
