import { describe, expect, it } from 'vitest';
import type { HotUpdateOptions } from 'vite';
import { SKETCH_ADDED_EVENT } from '../src/sketch/events.ts';
import { newSketchName, sketchWatchPlugin } from './sketch-watch.ts';

describe('newSketchName', () => {
  const root = '/repo';

  it('names the Sketch when a top-level main.frag appears in a sketches/ folder', () => {
    expect(newSketchName('/repo/sketches/2026-09-28-waves/main.frag', root)).toBe('2026-09-28-waves');
  });

  it('ignores other files, nested main.frag files and files outside sketches/', () => {
    expect(newSketchName('/repo/sketches/2026-09-28-waves/blur.frag', root)).toBeNull();
    expect(newSketchName('/repo/sketches/2026-09-28-waves/sketch.ts', root)).toBeNull();
    expect(newSketchName('/repo/sketches/2026-09-28-waves/old/main.frag', root)).toBeNull();
    expect(newSketchName('/repo/sketches/main.frag', root)).toBeNull();
    expect(newSketchName('/repo/templates/default/main.frag', root)).toBeNull();
    expect(newSketchName('/other/sketches/x/main.frag', root)).toBeNull();
  });
});

describe('sketchWatchPlugin', () => {
  function run(type: HotUpdateOptions['type'], file: string, environment = 'client') {
    const plugin = sketchWatchPlugin();
    (plugin.configResolved as (config: { root: string }) => void)({ root: '/repo' });
    const sent: unknown[] = [];
    const hook = plugin.hotUpdate as (this: unknown, options: HotUpdateOptions) => unknown;
    const result = hook.call(
      { environment: { name: environment, hot: { send: (payload: unknown) => sent.push(payload) } } },
      { type, file, timestamp: 0, modules: [], read: () => '' } as unknown as HotUpdateOptions,
    );
    return { sent, result };
  }

  it('sends the sketch-added event when a new Sketch main.frag is created, and leaves the update alone', () => {
    const { sent, result } = run('create', '/repo/sketches/2026-09-28-waves/main.frag');
    expect(sent).toEqual([{ type: 'custom', event: SKETCH_ADDED_EVENT, data: { name: '2026-09-28-waves' } }]);
    expect(result).toBeUndefined();
  });

  it('stays quiet for saves and deletes, other files, and non-client environments', () => {
    expect(run('update', '/repo/sketches/a/main.frag').sent).toEqual([]);
    expect(run('delete', '/repo/sketches/a/main.frag').sent).toEqual([]);
    expect(run('create', '/repo/sketches/a/blur.frag').sent).toEqual([]);
    expect(run('create', '/repo/sketches/a/main.frag', 'ssr').sent).toEqual([]);
  });
});
