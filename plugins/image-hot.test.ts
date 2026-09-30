import { describe, expect, it } from 'vitest';
import type { HotUpdateOptions } from 'vite';
import { IMAGE_UPDATED_EVENT } from '../src/sketch/events.ts';
import { imageHotPlugin } from './image-hot.ts';

describe('imageHotPlugin', () => {
  function run(type: HotUpdateOptions['type'], file: string, environment = 'client') {
    const plugin = imageHotPlugin();
    (plugin.configResolved as (config: { root: string }) => void)({ root: '/repo' });
    const sent: unknown[] = [];
    const hook = plugin.hotUpdate as (this: unknown, options: HotUpdateOptions) => unknown;
    const result = hook.call(
      { environment: { name: environment, hot: { send: (payload: unknown) => sent.push(payload) } } },
      { type, file, timestamp: 42, modules: [{ id: 'x' }], read: () => '' } as unknown as HotUpdateOptions,
    );
    return { sent, result };
  }

  it('announces a saved Sketch image and stops Vite from reloading the page for it', () => {
    const { sent, result } = run('update', '/repo/sketches/s/images/density.PNG');
    expect(sent).toEqual([{ type: 'custom', event: IMAGE_UPDATED_EVENT, data: { path: 'sketches/s/images/density.PNG', timestamp: 42 } }]);
    expect(result).toEqual([]);
  });

  it('leaves new and deleted images to the glob reload, and ignores other files and environments', () => {
    for (const [type, file, environment] of [
      ['create', '/repo/sketches/s/density.png'],
      ['delete', '/repo/sketches/s/density.png'],
      ['update', '/repo/sketches/s/main.frag'],
      ['update', '/repo/templates/default/density.png'],
      ['update', '/repo/sketches/s/density.Png'],
      ['update', '/repo/sketches/s/density.png', 'ssr'],
    ] as const) {
      expect(run(type, file, environment)).toEqual({ sent: [], result: undefined });
    }
  });
});
