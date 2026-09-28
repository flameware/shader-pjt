import { type HudState, createHudVisibility } from './hud-visibility';
import type { Keymap } from './keymap';

/** How long the mouse must rest before the HUD fades out (#9 decision 3). */
const IDLE_MS = 2500;

/**
 * The HUD's regions (#9 decision 1–6). Features mount their controls into these; the HUD only
 * decides when they show.
 */
export interface Hud {
  /** Sketch name button and badges (#20). */
  topLeft: HTMLElement;
  /** The Tweakpane panel (#19): `new Pane({ container: hud.topRight })`. */
  topRight: HTMLElement;
  /** The play bar. */
  bottom: HTMLElement;
  state(): HudState;
}

function region(className: string): HTMLElement {
  const node = document.createElement('div');
  node.className = `hud-region ${className}`;
  return node;
}

/**
 * Mounts the HUD overlay and registers `H`. It fades out after 2.5 s without mouse movement
 * (unless the pointer is over it) and `H` turns it off entirely. It is `position: fixed` over
 * the canvas, so hiding it never changes the canvas size. The error banner is mounted
 * separately and is never hidden with it.
 */
export function mountHud(parent: HTMLElement, keymap: Keymap): Hud {
  const root = document.createElement('div');
  root.className = 'hud';
  const topLeft = region('hud-top-left');
  const topRight = region('hud-top-right');
  const bottom = region('hud-bottom');
  root.append(topLeft, topRight, bottom);
  parent.append(root);

  const visibility = createHudVisibility({
    idleMs: IDLE_MS,
    onChange(state) {
      root.dataset.state = state;
      // A region hidden under the pointer never gets its pointerleave.
      if (state === 'off') visibility.setHovered(false);
    },
  });
  root.dataset.state = visibility.state();

  for (const node of [topLeft, topRight, bottom]) {
    node.addEventListener('pointerenter', () => visibility.setHovered(true));
    node.addEventListener('pointerleave', () => visibility.setHovered(false));
  }
  window.addEventListener('pointermove', () => visibility.activity());
  window.addEventListener('pointerdown', () => visibility.activity());

  keymap.add({ keys: ['H'], description: 'HUD 끄기 / 켜기', run: () => visibility.toggle() });

  return { topLeft, topRight, bottom, state: () => visibility.state() };
}
