import type { ClockTick } from '../engine/clock';
import type { Engine } from '../engine/engine';
import { type Hud, mountHud } from './hud';
import './hud.css';
import { type Keymap, createKeymap } from './keymap';
import { mountPlayBar } from './play-bar';
import { createFpsMeter } from './fps-meter';
import { playBarView } from './play-bar-view';
import { addPlaybackKeys, playbackActions } from './playback-actions';
import { mountShortcutHelp } from './shortcut-help';
import { type Toasts, mountToasts } from './toast';

/**
 * The browser UI around the canvas (#9 B): HUD, play bar, toasts, shortcut table and the one
 * keymap. Later features plug in here: keys through `keymap.add`, their UI into the HUD
 * regions, notices through `toasts.show`.
 */
export interface BrowserUi {
  keymap: Keymap;
  hud: Hud;
  toasts: Toasts;
  /** Call once per animation frame with what `engine.frame` returned. */
  frame(tick: ClockTick, nowMs: number): void;
}

export function mountBrowserUi(parent: HTMLElement, engine: Engine): BrowserUi {
  const keymap = createKeymap();
  window.addEventListener('keydown', (event) => {
    if (keymap.handle(event)) event.preventDefault();
  });

  // Registration order is the shortcut table's order.
  const actions = playbackActions(engine);
  addPlaybackKeys(keymap, actions);
  const hud = mountHud(parent, keymap);
  const toasts = mountToasts(parent);
  const playBar = mountPlayBar(hud.bottom, actions);
  mountShortcutHelp(parent, keymap);

  const fps = createFpsMeter();
  return {
    keymap,
    hud,
    toasts,
    frame(tick, nowMs) {
      const { playback } = engine;
      playBar.render(
        playBarView({ paused: playback.isPaused(), speed: playback.speed(), time: tick.time, frame: tick.frame, fps: fps.tick(nowMs) }),
      );
    },
  };
}
