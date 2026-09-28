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

/**
 * Each playback action's key and description (#9 decision 10): the shortcut table and the play
 * bar's tooltips both read this, so a key is named in one place.
 */
export const PLAYBACK_KEYS: Record<keyof PlaybackActions, { key: string; description: string; repeat?: boolean }> = {
  togglePause: { key: 'Space', description: '일시정지 / 재생' },
  reset: { key: 'R', description: '리셋 (시간 0, Feedback 비움)' },
  step: { key: '.', description: '한 프레임 진행 (일시정지)', repeat: true },
  slower: { key: '-', description: '느리게', repeat: true },
  faster: { key: '=', description: '빠르게', repeat: true },
  normalSpeed: { key: '0', description: '속도 1×' },
};

/** A play bar tooltip: the action and its key. */
export const playbackTitle = (action: keyof PlaybackActions, text = PLAYBACK_KEYS[action].description) =>
  `${text} (${PLAYBACK_KEYS[action].key})`;

/** Registers the playback rows of the shortcut table. */
export function addPlaybackKeys(keymap: Keymap, actions: PlaybackActions): void {
  for (const [action, { key, description, repeat }] of Object.entries(PLAYBACK_KEYS)) {
    keymap.add({ keys: [key], description, repeat, run: actions[action as keyof PlaybackActions] });
  }
}
