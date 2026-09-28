import { describe, expect, it } from 'vitest';
import { type SwitchPage, createSketchSwitch } from './switch';

function fakePage(href: string) {
  const store = new Map<string, string>();
  const timers: (() => void)[] = [];
  const page = {
    href,
    reloads: 0,
    location: {
      get href(): string {
        return page.href;
      },
      reload: () => void page.reloads++,
    },
    history: { replaceState: (_data: unknown, _unused: string, url: string) => void (page.href = url) },
    storage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    setTimeout: (run: () => void) => void timers.push(run),
    runTimers: () => timers.splice(0).forEach((run) => run()),
  } satisfies SwitchPage & Record<string, unknown>;
  return page;
}

const names = ['2026-09-26', '2026-09-27', '2026-09-28'];

describe('opening a Sketch', () => {
  it('opens the one in ?sketch and leaves the URL alone', () => {
    const page = fakePage('http://localhost/?sketch=2026-09-27');
    const opened = createSketchSwitch(page).open(names);
    expect(opened).toEqual({ name: '2026-09-27', notice: null });
    expect(page.href).toBe('http://localhost/?sketch=2026-09-27');
  });

  it('opens the latest Sketch without ?sketch and writes it into the URL', () => {
    const page = fakePage('http://localhost/');
    expect(createSketchSwitch(page).open(names)).toEqual({ name: '2026-09-28', notice: null });
    expect(page.href).toBe('http://localhost/?sketch=2026-09-28');
  });

  it('opens the latest Sketch for an unknown ?sketch, fixes the URL and says why', () => {
    const page = fakePage('http://localhost/?sketch=gone');
    const opened = createSketchSwitch(page).open(names);
    expect(opened.name).toBe('2026-09-28');
    expect(opened.notice).toContain('gone');
    expect(page.href).toBe('http://localhost/?sketch=2026-09-28');
  });

  it('opens nothing when there are no Sketches', () => {
    const page = fakePage('http://localhost/');
    expect(createSketchSwitch(page).open([])).toEqual({ name: null, notice: null });
    expect(page.href).toBe('http://localhost/');
  });
});

describe('switching Sketches', () => {
  it('rewrites ?sketch in place and reloads, so the new Sketch starts from time 0', () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    createSketchSwitch(page).go('2026-09-27');
    expect(page.href).toBe('http://localhost/?sketch=2026-09-27');
    expect(page.reloads).toBe(1);
  });

  it('carries a notice across the reload, shown once by the next open()', () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    createSketchSwitch(page).go('2026-09-28', { notice: '새 Sketch: 2026-09-28' });
    expect(createSketchSwitch(page).open(names)).toEqual({ name: '2026-09-28', notice: '새 Sketch: 2026-09-28' });
    expect(createSketchSwitch(page).open(names).notice).toBeNull();
  });

  it('can leave the reload to someone else, reloading itself only as a fallback', () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    createSketchSwitch(page).go('2026-09-28', { reload: 'fallback' });
    expect(page.href).toBe('http://localhost/?sketch=2026-09-28');
    expect(page.reloads).toBe(0);
    page.runTimers();
    expect(page.reloads).toBe(1);
  });

  it('works without storage (private mode): the switch still happens, the notice is dropped', () => {
    const page = { ...fakePage('http://localhost/?sketch=2026-09-26'), storage: null };
    const sketchSwitch = createSketchSwitch(page);
    sketchSwitch.go('2026-09-27', { notice: 'x' });
    expect(sketchSwitch.open(names).notice).toBeNull();
  });
});
