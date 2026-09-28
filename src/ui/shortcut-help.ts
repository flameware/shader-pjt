import { type Keymap, keyLabel } from './keymap';

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * The shortcut table (`?`), built from whatever is registered in the keymap when it opens, so
 * keys added by later features show up without touching this file. `?` or `Escape` closes it.
 * It sits outside the HUD, so it opens even with the HUD off.
 */
export function mountShortcutHelp(parent: HTMLElement, keymap: Keymap): void {
  const root = document.createElement('div');
  root.className = 'shortcut-help';
  root.hidden = true;
  parent.append(root);

  const render = () => {
    const title = document.createElement('p');
    title.className = 'shortcut-help-title';
    title.textContent = '단축키';
    const hint = document.createElement('span');
    hint.className = 'shortcut-help-hint';
    hint.textContent = '? 또는 Esc로 닫기';
    title.append(hint);

    const table = document.createElement('table');
    for (const binding of keymap.bindings()) {
      const row = table.insertRow();
      row.insertCell().textContent = binding.keys.map((key) => keyLabel(key, isMac())).join(' / ');
      row.insertCell().textContent = binding.description;
    }
    root.replaceChildren(title, table);
  };

  keymap.add({
    keys: ['?'],
    description: '단축키 표',
    run() {
      if (root.hidden) render();
      root.hidden = !root.hidden;
    },
  });
  // Esc is not listed: it only closes this table, and it must stay free for the palette (#20).
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !root.hidden) root.hidden = true;
  });
}
