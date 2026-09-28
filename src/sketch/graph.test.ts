import { describe, expect, it } from 'vitest';
import { prev } from './define';
import { buildPassGraph, type PassGraphInput } from './graph';

const dir = 'sketches/s';
const input = (passes: string[], config?: unknown, floatLinear = true): PassGraphInput => ({
  sketchFile: `${dir}/sketch.ts`,
  passFiles: Object.fromEntries(passes.map((p) => [p, `${dir}/${p}.frag`])),
  config,
  floatLinear,
});

describe('buildPassGraph', () => {
  it('runs only main, with no Channels, when there is no sketch.ts', () => {
    const { graph, diagnostics } = buildPassGraph(input(['main']));
    expect(diagnostics).toEqual([]);
    expect(graph?.order).toEqual(['main']);
    expect(graph?.passes.main).toMatchObject({ file: `${dir}/main.frag`, channels: [], feedback: false });
  });

  it('runs a buffer Pass before the main pass that reads it, wiring the Channel slot', () => {
    const { graph, diagnostics } = buildPassGraph(input(['blur', 'main'], { passes: { main: { channels: ['blur'] } } }));
    expect(diagnostics).toEqual([]);
    expect(graph?.order).toEqual(['blur', 'main']);
    expect(graph?.passes.main?.channels).toEqual([{ pass: 'blur', prev: false }]);
  });

  it('orders by this frame’s references first and by name where order does not matter', () => {
    const config = {
      passes: {
        main: { channels: ['d', 'b', 'a'] },
        a: { channels: ['c'] },
        b: {},
      },
    };
    // a needs c; b and d are free. Name order among ready Passes: b, c, then a (now ready), d.
    const { graph } = buildPassGraph(input(['a', 'b', 'c', 'd', 'main'], config));
    expect(graph?.order).toEqual(['b', 'c', 'a', 'd', 'main']);
  });

  it('lets main read its own previous frame with prev("main"), marking it as a Feedback buffer', () => {
    const { graph, diagnostics } = buildPassGraph(input(['main'], { passes: { main: { channels: [prev('main')] } } }));
    expect(diagnostics).toEqual([]);
    expect(graph?.order).toEqual(['main']);
    expect(graph?.passes.main).toMatchObject({ channels: [{ pass: 'main', prev: true }], feedback: true });
  });

  it('does not order by prev() references, so two Passes may read each other’s previous frame', () => {
    const config = { passes: { main: { channels: ['a', 'b'] }, a: { channels: [prev('b')] }, b: { channels: ['a'] } } };
    const { graph, diagnostics } = buildPassGraph(input(['a', 'b', 'main'], config));
    expect(diagnostics).toEqual([]);
    expect(graph?.order).toEqual(['a', 'b', 'main']);
    expect(graph?.passes.b?.feedback).toBe(true);
    expect(graph?.passes.a?.feedback).toBe(false);
  });

  it('keeps a Pass nothing leads to out of the run order, with a warning, but still lists it (so it compiles)', () => {
    const { graph, diagnostics } = buildPassGraph(input(['main', 'scratch']));
    expect(graph?.order).toEqual(['main']);
    expect(graph?.passes.scratch).toBeDefined();
    expect(diagnostics).toEqual([
      { severity: 'warning', file: `${dir}/scratch.frag`, message: expect.stringContaining('참조되지 않은 Pass') },
    ]);
  });

  it('runs a Pass that main reaches only through prev(), and whatever that Pass reads', () => {
    const config = { passes: { main: { channels: [prev('sim')] }, sim: { channels: [prev('sim'), 'seed'] } } };
    const { graph, diagnostics } = buildPassGraph(input(['main', 'seed', 'sim'], config));
    expect(diagnostics).toEqual([]);
    expect(graph?.order).toEqual(['seed', 'sim', 'main']);
  });

  it('treats a Pass read only by an unreferenced Pass as unreferenced too', () => {
    const config = { passes: { scratch: { channels: ['helper'] } } };
    const { graph, diagnostics } = buildPassGraph(input(['helper', 'main', 'scratch'], config));
    expect(graph?.order).toEqual(['main']);
    expect(diagnostics.map((d) => d.file)).toEqual([`${dir}/helper.frag`, `${dir}/scratch.frag`]);
  });

  it('rejects a cycle in this frame’s references, naming the loop', () => {
    const config = { passes: { main: { channels: ['a'] }, a: { channels: ['b'] }, b: { channels: ['c'] }, c: { channels: ['a'] } } };
    const { graph, diagnostics } = buildPassGraph(input(['a', 'b', 'c', 'main'], config));
    expect(graph).toBeNull();
    expect(diagnostics).toEqual([
      { severity: 'error', file: `${dir}/sketch.ts`, message: expect.stringContaining('a → b → c → a') },
    ]);
  });

  it('rejects a cycle even between Passes that do not run', () => {
    const config = { passes: { a: { channels: ['b'] }, b: { channels: ['a'] } } };
    const { graph, diagnostics } = buildPassGraph(input(['a', 'b', 'main'], config));
    expect(graph).toBeNull();
    expect(diagnostics).toContainEqual({ severity: 'error', file: `${dir}/sketch.ts`, message: expect.stringContaining('a → b → a') });
  });

  it('rejects a Pass reading itself this frame (use prev() for that)', () => {
    const { graph, diagnostics } = buildPassGraph(input(['a', 'main'], { passes: { main: { channels: ['a'] }, a: { channels: ['a'] } } }));
    expect(graph).toBeNull();
    expect(diagnostics[0]?.message).toContain('a → a');
  });

  describe('rejects invalid sketch.ts values as errors against sketch.ts', () => {
    const cases: [string, unknown, string][] = [
      ['a default export that is not an object', null, 'export default defineSketch'],
      ['a non-string title', { title: 3 }, 'title'],
      ['an unknown top-level key', { pass: {} }, "알 수 없는 키 'pass'"],
      ['passes that is not an object', { passes: [] }, 'passes'],
      ['options for a Pass with no .frag', { passes: { blurr: {} } }, "'blurr'"],
      ['a Channel naming a Pass with no .frag', { passes: { main: { channels: ['blurr'] } } }, "'blurr'"],
      ['prev() of a Pass with no .frag', { passes: { main: { channels: [prev('nope')] } } }, "'nope'"],
      ['more than four Channels', { passes: { main: { channels: ['a', 'a', 'a', 'a', 'a'] } } }, '최대 4개'],
      ['channels that is not an array', { passes: { main: { channels: 'a' } } }, 'channels'],
      ['a Channel that is neither a name nor prev()', { passes: { main: { channels: [1] } } }, 'iChannel0'],
      ['reading main this frame from another Pass', { passes: { main: { channels: ['a'] }, a: { channels: ['main'] } } }, "prev('main')"],
      ['an unknown format', { passes: { a: { format: 'rgba16' } } }, 'format'],
      ['an unknown filter', { passes: { a: { filter: 'bilinear' } } }, 'filter'],
      ['an unknown wrap', { passes: { a: { wrap: 'clamp_to_edge' } } }, 'wrap'],
      ['a non-positive scale', { passes: { a: { scale: 0 } } }, 'scale'],
      ['a size that is not two positive integers', { passes: { a: { size: [256] } } }, 'size'],
      ['both scale and size', { passes: { a: { scale: 0.5, size: [256, 256] } } }, 'scale'],
      ['an unknown Pass option', { passes: { a: { channel: ['main'] } } }, "알 수 없는 키 'channel'"],
      ['a format on main', { passes: { main: { format: 'rgba8' } } }, 'main'],
      ['a size on main', { passes: { main: { scale: 0.5 } } }, 'main'],
    ];
    it.each(cases)('%s', (_, config, text) => {
      const { graph, diagnostics } = buildPassGraph(input(['a', 'main'], config));
      expect(graph).toBeNull();
      expect(diagnostics).toContainEqual({ severity: 'error', file: `${dir}/sketch.ts`, message: expect.stringContaining(text) });
    });
  });

  describe('buffer options', () => {
    const bufferOf = (options: object, floatLinear = true) =>
      buildPassGraph(input(['a', 'main'], { passes: { main: { channels: ['a'] }, a: options } }, floatLinear));

    it('default to rgba16f, linear, clamp, scale 1', () => {
      expect(bufferOf({}).graph?.passes.a?.buffer).toEqual({ format: 'rgba16f', filter: 'linear', wrap: 'clamp', size: { scale: 1 } });
    });

    it('take what sketch.ts sets', () => {
      const { graph } = bufferOf({ format: 'rgba8', filter: 'nearest', wrap: 'mirror', size: [256, 128] });
      expect(graph?.passes.a?.buffer).toEqual({ format: 'rgba8', filter: 'nearest', wrap: 'mirror', size: { size: [256, 128] } });
      expect(bufferOf({ scale: 0.5 }).graph?.passes.a?.buffer.size).toEqual({ scale: 0.5 });
    });

    it('default rgba32f to nearest filtering', () => {
      expect(bufferOf({ format: 'rgba32f' }).graph?.passes.a?.buffer.filter).toBe('nearest');
    });

    it('keep an explicit linear on rgba32f when the device has OES_texture_float_linear', () => {
      const { graph, diagnostics } = bufferOf({ format: 'rgba32f', filter: 'linear' }, true);
      expect(graph?.passes.a?.buffer.filter).toBe('linear');
      expect(diagnostics).toEqual([]);
    });

    it('fall back from linear to nearest on rgba32f without OES_texture_float_linear, with only a warning', () => {
      const { graph, diagnostics } = bufferOf({ format: 'rgba32f', filter: 'linear' }, false);
      expect(graph?.passes.a?.buffer.filter).toBe('nearest');
      expect(diagnostics).toEqual([
        { severity: 'warning', file: `${dir}/sketch.ts`, message: expect.stringContaining('OES_texture_float_linear') },
      ]);
    });

    it('let main choose filter and wrap for whoever reads prev("main")', () => {
      const { graph } = buildPassGraph(input(['main'], { passes: { main: { channels: [prev('main')], wrap: 'repeat' } } }));
      expect(graph?.passes.main?.buffer).toEqual({ format: 'rgba16f', filter: 'linear', wrap: 'repeat', size: { scale: 1 } });
    });
  });

  it('passes the title through', () => {
    expect(buildPassGraph(input(['main'], { title: 'Trails' })).graph?.title).toBe('Trails');
  });

  it('reports every sketch.ts error at once', () => {
    const config = { passes: { main: { channels: ['x'] }, a: { format: 'rgb', wrap: 'loop' } } };
    const { diagnostics } = buildPassGraph(input(['a', 'main'], config));
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(3);
  });
});
