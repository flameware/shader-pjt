/**
 * `shown`: on screen. `idle`: faded out after the mouse stopped moving; movement brings it back.
 * `off`: turned off with `H`; only `H` brings it back.
 */
export type HudState = 'shown' | 'idle' | 'off';

export interface HudVisibility {
  /** The mouse moved (or was pressed): show the HUD and restart the idle timer. */
  activity(): void;
  /** Whether the pointer is over a HUD element; the HUD never goes idle while it is. */
  setHovered(hovered: boolean): void;
  /** `H`: off, or back on. */
  toggle(): void;
  state(): HudState;
}

/** The auto-hide rules of #9 decision 3, without the DOM. `onChange` fires on every state change. */
export function createHudVisibility(options: { idleMs: number; onChange(state: HudState): void }): HudVisibility {
  let state: HudState = 'shown';
  let hovered = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const set = (next: HudState) => {
    if (next === state) return;
    state = next;
    options.onChange(state);
  };
  const restartTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (state === 'shown' && !hovered) set('idle');
    }, options.idleMs);
  };
  const wake = () => {
    if (state === 'off') return;
    set('shown');
    restartTimer();
  };

  restartTimer();
  return {
    activity: wake,
    setHovered(next) {
      hovered = next;
      if (!hovered) wake();
    },
    toggle() {
      if (state === 'off') {
        set('shown');
        restartTimer();
      } else {
        clearTimeout(timer);
        set('off');
      }
    },
    state: () => state,
  };
}
