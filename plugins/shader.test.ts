import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { shaderPlugin, shaderSource } from './shader';

describe('shaderSource', () => {
  it('keeps the source and maps every line to the same line of the file', () => {
    expect(shaderSource('a\nb\nc', 'sketches/x/main.frag')).toEqual({
      source: 'a\nb\nc',
      lines: [
        [0, 1],
        [0, 2],
        [0, 3],
      ],
      files: ['sketches/x/main.frag'],
    });
  });
});

describe('shaderPlugin in the dev server', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      logLevel: 'silent',
      root: fileURLToPath(new URL('./fixtures', import.meta.url)),
      plugins: [shaderPlugin()],
      server: { middlewareMode: true, hmr: false, watch: null },
    });
  });

  afterAll(() => server.close());

  it('turns a .frag into a module that accepts its own hot updates, so saving never falls back to a full reload', async () => {
    const result = await server.transformRequest('/sketches/demo/main.frag?import');
    expect(result).not.toBeNull();
    const mod = await server.moduleGraph.getModuleByUrl('/sketches/demo/main.frag?import');
    expect(mod?.isSelfAccepting).toBe(true);
  });

  it('exports the shader source with its line table', async () => {
    const mod = await server.ssrLoadModule('/sketches/demo/main.frag');
    expect(mod.default.files).toEqual(['sketches/demo/main.frag']);
    expect(mod.default.source).toContain('void mainImage(');
    expect(mod.default.lines[0]).toEqual([0, 1]);
  });
});
