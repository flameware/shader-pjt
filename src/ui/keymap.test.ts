import { describe, expect, it } from 'vitest';
import { type KeyInput, createKeymap, keyLabel } from './keymap';

const press = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  repeat: false,
  target: null,
  ...extra,
});

function setup(keys: string[], options: { repeat?: boolean } = {}) {
  const keymap = createKeymap();
  const runs: string[] = [];
  for (const key of keys) keymap.add({ keys: [key], description: key, run: () => void runs.push(key), ...options });
  return { keymap, runs };
}

describe('keyLabel', () => {
  it('shows Mod as ⌘ on macOS and Ctrl elsewhere', () => {
    expect(['Mod+K', 'Shift+C', 'Space', '?'].map((k) => keyLabel(k, true))).toEqual(['⌘K', 'Shift+C', 'Space', '?']);
    expect(keyLabel('Mod+K', false)).toBe('Ctrl+K');
  });
});

describe('keymap', () => {
  it('runs the binding for a pressed key and reports it handled', () => {
    const { keymap, runs } = setup(['.']);
    expect(keymap.handle(press('.'))).toBe(true);
    expect(keymap.handle(press(','))).toBe(false);
    expect(runs).toEqual(['.']);
  });

  it('a letter binding ignores case but not Shift: R is r, Shift+C is C', () => {
    const { keymap, runs } = setup(['R', 'C', 'Shift+C']);
    keymap.handle(press('r'));
    keymap.handle(press('R', { shiftKey: false })); // Caps Lock
    keymap.handle(press('c'));
    keymap.handle(press('C', { shiftKey: true }));
    expect(runs).toEqual(['R', 'R', 'C', 'Shift+C']);
  });

  it('a symbol binding matches the character typed, whatever Shift it took', () => {
    const { keymap, runs } = setup(['?', '=']);
    keymap.handle(press('?', { shiftKey: true }));
    keymap.handle(press('='));
    expect(runs).toEqual(['?', '=']);
  });

  it('Space names the space bar', () => {
    const { keymap, runs } = setup(['Space']);
    keymap.handle(press(' '));
    expect(runs).toEqual(['Space']);
  });

  it('leaves ⌘/Ctrl/Alt combinations to the browser unless the binding asks for them', () => {
    const { keymap, runs } = setup(['R', 'Mod+K']);
    expect(keymap.handle(press('r', { metaKey: true }))).toBe(false);
    expect(keymap.handle(press('r', { ctrlKey: true }))).toBe(false);
    expect(keymap.handle(press('r', { altKey: true }))).toBe(false);
    expect(keymap.handle(press('k'))).toBe(false);
    keymap.handle(press('k', { metaKey: true }));
    keymap.handle(press('k', { ctrlKey: true }));
    expect(runs).toEqual(['Mod+K', 'Mod+K']);
  });

  it('does not take keys typed into an input, textarea, select or editable element', () => {
    const { keymap, runs } = setup(['Space', 'R']);
    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }]) {
      expect(keymap.handle(press(' ', { target }))).toBe(false);
    }
    keymap.handle(press('r', { target: { tagName: 'BUTTON' } }));
    expect(runs).toEqual(['R']);
  });

  it('ignores auto-repeat unless the binding allows it', () => {
    const toggles = setup(['Space']);
    toggles.keymap.handle(press(' ', { repeat: true }));
    const steps = setup(['.'], { repeat: true });
    steps.keymap.handle(press('.', { repeat: true }));
    expect([toggles.runs, steps.runs]).toEqual([[], ['.']]);
  });

  it('lists bindings in the order they were added, for the shortcut table, and can remove one', () => {
    const keymap = createKeymap();
    keymap.add({ keys: ['Space'], description: '일시정지 / 재생', run: () => {} });
    const remove = keymap.add({ keys: ['-', '_'], description: '느리게', run: () => {} });
    keymap.add({ keys: ['H'], description: 'HUD', run: () => {} });
    expect(keymap.bindings().map((b) => b.keys)).toEqual([['Space'], ['-', '_'], ['H']]);
    remove();
    expect(keymap.bindings().map((b) => b.description)).toEqual(['일시정지 / 재생', 'HUD']);
    expect(keymap.handle(press('-'))).toBe(false);
  });

  it('refuses a key that is already bound, so two features cannot silently fight over it', () => {
    const keymap = createKeymap();
    keymap.add({ keys: ['R'], description: 'reset', run: () => {} });
    expect(() => keymap.add({ keys: ['r'], description: 'other', run: () => {} })).toThrow(/R/);
  });
});
