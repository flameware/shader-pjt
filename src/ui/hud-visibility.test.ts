import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type HudState, createHudVisibility } from './hud-visibility';

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

function setup() {
  const changes: HudState[] = [];
  const hud = createHudVisibility({ idleMs: 2500, onChange: (state) => changes.push(state) });
  return { hud, changes };
}

describe('HUD visibility', () => {
  it('starts shown and goes idle after 2.5 s without mouse movement', () => {
    const { hud, changes } = setup();
    expect(hud.state()).toBe('shown');
    vi.advanceTimersByTime(2499);
    expect(hud.state()).toBe('shown');
    vi.advanceTimersByTime(1);
    expect(hud.state()).toBe('idle');
    expect(changes).toEqual(['idle']);
  });

  it('mouse movement shows it again and restarts the 2.5 s', () => {
    const { hud, changes } = setup();
    vi.advanceTimersByTime(2000);
    hud.activity();
    vi.advanceTimersByTime(2000);
    expect(hud.state()).toBe('shown');
    vi.advanceTimersByTime(500);
    expect(hud.state()).toBe('idle');
    hud.activity();
    expect(hud.state()).toBe('shown');
    expect(changes).toEqual(['idle', 'shown']);
  });

  it('does not hide while the pointer is over the HUD; leaving starts the 2.5 s again', () => {
    const { hud } = setup();
    hud.setHovered(true);
    vi.advanceTimersByTime(10_000);
    expect(hud.state()).toBe('shown');
    hud.setHovered(false);
    vi.advanceTimersByTime(2499);
    expect(hud.state()).toBe('shown');
    vi.advanceTimersByTime(1);
    expect(hud.state()).toBe('idle');
  });

  it('H turns it off for good, and on again (then the idle timer runs as usual)', () => {
    const { hud, changes } = setup();
    hud.toggle();
    expect(hud.state()).toBe('off');
    hud.activity();
    vi.advanceTimersByTime(10_000);
    expect(hud.state()).toBe('off');
    hud.toggle();
    expect(hud.state()).toBe('shown');
    vi.advanceTimersByTime(2500);
    expect(changes).toEqual(['off', 'shown', 'idle']);
  });

  it('H while idle turns it off, and movement does not bring it back', () => {
    const { hud } = setup();
    vi.advanceTimersByTime(2500);
    hud.toggle();
    hud.activity();
    expect(hud.state()).toBe('off');
  });
});
