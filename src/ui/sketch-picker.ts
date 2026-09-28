import { SKETCH_ADDED_EVENT } from '../sketch/events';
import { neighbourSketch } from '../sketch/navigate';
import type { SketchSwitch } from '../sketch/switch';
import type { BrowserUi } from './browser-ui';
import { keyLabel } from './keymap';
import { createPaletteState } from './palette-state';
import './sketch-picker.css';

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export interface SketchPicker {
  /** Shows or hides the feedback badge next to the name (once the pass graph is known). */
  setFeedback(feedback: boolean): void;
}

export interface SketchPickerOptions {
  /** Every Sketch, sorted by name. */
  names: readonly string[];
  current: string;
  sketchSwitch: SketchSwitch;
}

/**
 * Moving between Sketches (#9 decisions 4, 9; #20): the Sketch name button and badges in the
 * HUD's top left, the palette (click the name, `⌘K` or `/`; type to filter, `↑↓` `Enter` `Esc`),
 * `[` / `]` for the previous / next Sketch by name, and the switch to a new Sketch folder the dev
 * server reports.
 */
export function mountSketchPicker(parent: HTMLElement, ui: BrowserUi, { names, current, sketchSwitch }: SketchPickerOptions): SketchPicker {
  const go = (name: string) => {
    if (name !== current) sketchSwitch.go(name);
  };

  // Top left: name button + feedback badge. The Output size badge (#22) is appended after them.
  const nameButton = document.createElement('button');
  nameButton.className = 'sketch-name hud-glass';
  nameButton.textContent = `${current} ▾`;
  nameButton.title = `Sketch 팔레트 (${keyLabel('Mod+K', isMac())}, /)`;
  // Never take focus, so Space after a click still means play/pause.
  nameButton.addEventListener('mousedown', (event) => event.preventDefault());
  nameButton.addEventListener('click', () => openPalette());
  const feedbackBadge = document.createElement('span');
  feedbackBadge.className = 'sketch-badge sketch-badge-feedback';
  feedbackBadge.textContent = 'feedback';
  feedbackBadge.hidden = true;
  ui.hud.topLeft.append(nameButton, feedbackBadge);

  // The palette sits outside the HUD, like the shortcut table, so it opens with the HUD off.
  const palette = document.createElement('div');
  palette.className = 'sketch-palette';
  palette.hidden = true;
  const box = document.createElement('div');
  box.className = 'sketch-palette-box';
  const input = document.createElement('input');
  input.className = 'sketch-palette-input';
  input.placeholder = 'Sketch 이름…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Sketch 찾기');
  const list = document.createElement('ul');
  list.className = 'sketch-palette-list';
  list.setAttribute('role', 'listbox');
  box.append(input, list);
  palette.append(box);
  parent.append(palette);

  let state = createPaletteState(names, current);

  const render = () => {
    const { items, selected } = state.view();
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'sketch-palette-empty';
      empty.textContent = '일치하는 Sketch 없음';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(
      ...items.map((item, index) => {
        const row = document.createElement('li');
        row.setAttribute('role', 'option');
        row.dataset.index = String(index);
        row.textContent = item.name;
        row.classList.toggle('current', item.current);
        row.classList.toggle('selected', index === selected);
        row.setAttribute('aria-selected', String(index === selected));
        return row;
      }),
    );
    list.children[selected]?.scrollIntoView({ block: 'nearest' });
  };

  function openPalette() {
    state = createPaletteState(names, current);
    input.value = '';
    palette.hidden = false;
    render();
    input.focus();
  }
  const closePalette = () => {
    palette.hidden = true;
    input.blur();
  };
  const choose = () => {
    const name = state.chosen();
    if (name === null) return;
    closePalette();
    go(name);
  };

  input.addEventListener('input', () => {
    state.setQuery(input.value);
    render();
  });
  // The keymap ignores keys typed into an input, so while the palette has focus these are the only keys.
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return; // Enter / arrows belong to the IME while it composes.
    const mod = event.metaKey || event.ctrlKey;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      state.move(event.key === 'ArrowDown' ? 1 : -1);
      render();
    } else if (event.key === 'Enter') choose();
    else if (event.key === 'Escape' || (mod && event.key.toLowerCase() === 'k')) closePalette();
    else return;
    event.preventDefault();
  });
  input.addEventListener('blur', () => {
    // Clicking outside the box (or switching windows) closes it; clicks inside keep focus (below).
    if (!palette.hidden) closePalette();
  });
  box.addEventListener('mousedown', (event) => {
    if (event.target !== input) event.preventDefault();
  });
  list.addEventListener('mousemove', (event) => {
    const index = Number((event.target as HTMLElement).closest<HTMLElement>('li[data-index]')?.dataset.index ?? NaN);
    if (Number.isNaN(index) || index === state.view().selected) return;
    state.select(index);
    render();
  });
  list.addEventListener('click', (event) => {
    const index = Number((event.target as HTMLElement).closest<HTMLElement>('li[data-index]')?.dataset.index ?? NaN);
    if (Number.isNaN(index)) return;
    state.select(index);
    choose();
  });

  ui.keymap.add({ keys: ['Mod+K', '/'], description: 'Sketch 팔레트', run: openPalette });
  ui.keymap.add({ keys: ['['], description: '이전 Sketch (이름순)', run: () => go(neighbourSketch(names, current, -1)) });
  ui.keymap.add({ keys: [']'], description: '다음 Sketch (이름순)', run: () => go(neighbourSketch(names, current, 1)) });

  // A new Sketch folder (#12 decision 10). Vite reloads the page right after this event, because
  // the Sketch globs in main.ts changed; the URL is rewritten first so that reload opens the new
  // Sketch, and the notice rides along to be shown there.
  import.meta.hot?.on(SKETCH_ADDED_EVENT, ({ name }) => {
    if (name !== current) sketchSwitch.go(name, { notice: `새 Sketch: ${name}`, reload: 'fallback' });
  });

  return {
    setFeedback(feedback) {
      feedbackBadge.hidden = !feedback;
    },
  };
}
