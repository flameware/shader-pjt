import type { Engine } from '../engine/engine';
import { faster, slower } from '../engine/speed';
import type { Keymap } from './keymap';

/** What the play bar buttons and the playback shortcuts do. */
export interface PlaybackActions {
  togglePause(): void;
  /** Time 0, `iFrame` 0, Feedback cleared (the engine's reset). */
  reset(): void;
  /** One frame forward; pauses first if playing. */
  step(): void;
  slower(): void;
  faster(): void;
  normalSpeed(): void;
}

export function playbackActions(engine: Pick<Engine, 'playback' | 'reset'>): PlaybackActions {
  const { playback } = engine;
  return {
    togglePause: () => playback.setPaused(!playback.isPaused()),
    reset: () => engine.reset(),
    step: () => playback.step(),
    slower: () => playback.setSpeed(slower(playback.speed())),
    faster: () => playback.setSpeed(faster(playback.speed())),
    normalSpeed: () => playback.setSpeed(1),
  };
}

/** The playback rows of #9 decision 10's shortcut table. */
export function addPlaybackKeys(keymap: Keymap, actions: PlaybackActions): void {
  keymap.add({ keys: ['Space'], description: '일시정지 / 재생', run: actions.togglePause });
  keymap.add({ keys: ['R'], description: '리셋 (시간 0, Feedback 비움)', run: actions.reset });
  keymap.add({ keys: ['.'], description: '한 프레임 진행 (일시정지)', run: actions.step, repeat: true });
  keymap.add({ keys: ['-'], description: '느리게', run: actions.slower, repeat: true });
  keymap.add({ keys: ['='], description: '빠르게', run: actions.faster, repeat: true });
  keymap.add({ keys: ['0'], description: '속도 1×', run: actions.normalSpeed });
}
