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
    time: 0,
    now: (): number => page.time,
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

  it('carries a notice across the reload to the next open()', () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    createSketchSwitch(page).go('2026-09-28', { notice: '새 Sketch: 2026-09-28' });
    expect(createSketchSwitch(page).open(names)).toEqual({ name: '2026-09-28', notice: '새 Sketch: 2026-09-28' });
  });

  it('keeps the notice through a second reload right after (a new Sketch can cause several), not later', () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    createSketchSwitch(page).go('2026-09-28', { notice: 'n' });
    page.time = 500;
    createSketchSwitch(page).open(names);
    page.time = 1500;
    expect(createSketchSwitch(page).open(names).notice).toBe('n');
    page.time = 5000;
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

  it('waits for a Recording to be saved before reloading, with where it went in the notice', async () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    let saved!: (text: string) => void;
    const saving = new Promise<string | null>((resolve) => (saved = resolve));
    createSketchSwitch(page).go('2026-09-27', { waitFor: saving });
    expect(page.reloads).toBe(0);
    page.time = 10_000; // a long save doesn't let the notice expire
    saved('Recording 저장: captures/2026-09-26/a.mp4');
    await saving;
    await Promise.resolve();
    expect(page.reloads).toBe(1);
    expect(createSketchSwitch(page).open(names).notice).toBe('Recording 저장: captures/2026-09-26/a.mp4');
  });

  it('rewrites ?sketch before the save, so a reload that comes sooner (a new Sketch folder) still opens the new Sketch', async () => {
    const page = fakePage('http://localhost/?sketch=2026-09-26');
    const saving = Promise.resolve('Recording 저장: x.mp4');
    createSketchSwitch(page).go('2026-09-28', { notice: '새 Sketch: 2026-09-28', reload: 'fallback', waitFor: saving });
    expect(page.href).toBe('http://localhost/?sketch=2026-09-28');
    await saving;
    await Promise.resolve();
    expect(page.reloads).toBe(0);
    page.runTimers();
    expect(page.reloads).toBe(1);
    expect(createSketchSwitch(page).open(names).notice).toBe('새 Sketch: 2026-09-28 · Recording 저장: x.mp4');
  });

  it('works without storage (private mode): the switch still happens, the notice is dropped', () => {
    const page = { ...fakePage('http://localhost/?sketch=2026-09-26'), storage: null };
    const sketchSwitch = createSketchSwitch(page);
    sketchSwitch.go('2026-09-27', { notice: 'x' });
    expect(sketchSwitch.open(names).notice).toBeNull();
  });

  it('still switches when storing the notice throws (storage full or blocked)', () => {
    const base = fakePage('http://localhost/?sketch=2026-09-26');
    const page = {
      ...base,
      storage: {
        ...base.storage,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
      },
    };
    createSketchSwitch(page).go('2026-09-27', { notice: 'x' });
    expect(base.href).toBe('http://localhost/?sketch=2026-09-27');
    expect(base.reloads).toBe(1);
  });
});
