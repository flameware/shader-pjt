import type { PlayBarView } from './play-bar-view';
import { type PlaybackActions, playbackTitle } from './playback-actions';

/** The mounted play bar; `render` updates its text each frame. */
export interface PlayBar {
  render(view: PlayBarView): void;
}

function button(text: string, title: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.title = title;
  node.addEventListener('click', onClick);
  // Keep focus off the button: a focused button would also take Space/Enter itself.
  node.addEventListener('mousedown', (event) => event.preventDefault());
  return node;
}

function span(className: string): HTMLSpanElement {
  const node = document.createElement('span');
  node.className = className;
  return node;
}

/** The pill at the bottom centre (#9 decision 6): pause/play, reset, step, speed −/+, `t`·`f`·fps. */
export function mountPlayBar(parent: HTMLElement, actions: PlaybackActions): PlayBar {
  const root = document.createElement('div');
  root.className = 'play-bar hud-glass';

  const toggle = button('', '', actions.togglePause); // filled in by render
  const speed = span('play-bar-speed');
  speed.title = playbackTitle('normalSpeed');
  speed.addEventListener('click', actions.normalSpeed);
  const clock = span('play-bar-clock');
  root.append(
    toggle,
    button('↺', playbackTitle('reset'), actions.reset),
    button('⏭', playbackTitle('step'), actions.step),
    span('play-bar-sep'),
    button('−', playbackTitle('slower'), actions.slower),
    speed,
    button('+', playbackTitle('faster'), actions.faster),
    span('play-bar-sep'),
    clock,
  );
  parent.append(root);

  const setText = (node: HTMLElement, text: string) => {
    if (node.textContent !== text) node.textContent = text;
  };
  return {
    render(view) {
      setText(toggle, view.toggle);
      toggle.title = view.toggleTitle;
      setText(speed, view.speed);
      setText(clock, view.clock);
    },
  };
}
