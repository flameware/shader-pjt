import type { PlayBarView } from './play-bar-view';
import type { PlaybackActions } from './playback-controls';

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

  const toggle = button('⏸', '일시정지 (Space)', actions.togglePause);
  const speed = span('play-bar-speed');
  speed.title = '1×로 (0)';
  speed.addEventListener('click', actions.normalSpeed);
  const clock = span('play-bar-clock');
  root.append(
    toggle,
    button('↺', '리셋: 시간 0, Feedback 비움 (R)', actions.reset),
    button('⏭', '한 프레임 진행 (.)', actions.step),
    span('play-bar-sep'),
    button('−', '느리게 (-)', actions.slower),
    speed,
    button('+', '빠르게 (=)', actions.faster),
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
