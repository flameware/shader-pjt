import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type HotUpdateOptions, type Plugin, type ViteDevServer } from 'vite';
import { shaderPlugin } from './shader';

function devServer(root: string): Promise<ViteDevServer> {
  return createServer({
    configFile: false,
    logLevel: 'silent',
    root,
    plugins: [shaderPlugin()],
    server: { middlewareMode: true, hmr: false, watch: null },
  });
}

describe('shaderPlugin in the dev server', () => {
  const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));
  let server: ViteDevServer;

  beforeAll(async () => {
    server = await devServer(fixtures);
  });

  afterAll(() => server.close());

  it('turns a .frag into a module that accepts its own hot updates, so saving never falls back to a full reload', async () => {
    const result = await server.transformRequest('/sketches/sample/main.frag?import');
    expect(result).not.toBeNull();
    const mod = await server.moduleGraph.getModuleByUrl('/sketches/sample/main.frag?import');
    expect(mod?.isSelfAccepting).toBe(true);
  });

  it('exports the shader source with its line table', async () => {
    const mod = await server.ssrLoadModule('/sketches/sample/main.frag');
    expect(mod.default.files).toEqual(['sketches/sample/main.frag']);
    expect(mod.default.source).toContain('void mainImage(');
    expect(mod.default.lines[0]).toEqual([0, 1]);
  });

  it('expands #include from lib/ and the Sketch folder, with project-relative files', async () => {
    const mod = await server.ssrLoadModule('/sketches/includes/main.frag');
    expect(mod.default.files).toEqual(['sketches/includes/main.frag', 'lib/math/halve.glsl', 'sketches/includes/common.glsl']);
    expect(mod.default.source).toContain('vec3 halve(vec3 v)');
    expect(mod.default.resolveErrors).toBeUndefined();
  });

  it('watches every included file, so saving one hot-swaps the Pass that includes it', async () => {
    await server.transformRequest('/sketches/includes/main.frag?import');
    const mod = await server.moduleGraph.getModuleByUrl('/sketches/includes/main.frag?import');
    const imported = [...(mod?.importedModules ?? [])].map((m) => m.file);
    expect(imported).toEqual(
      expect.arrayContaining([path.join(fixtures, 'lib/math/halve.glsl'), path.join(fixtures, 'sketches/includes/common.glsl')]),
    );
  });
});

describe('shaderPlugin and a missing include', () => {
  let root: string;
  let server: ViteDevServer;

  beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shader-plugin-')));
    fs.mkdirSync(path.join(root, 'sketches/s'), { recursive: true });
    fs.writeFileSync(path.join(root, 'sketches/s/main.frag'), '#include "lib/later.glsl"\nvoid mainImage(out vec4 c, in vec2 p) {}\n');
    server = await devServer(root);
  });

  afterAll(async () => {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('exports the resolve error instead of failing the module', async () => {
    const mod = await server.ssrLoadModule('/sketches/s/main.frag');
    expect(mod.default.resolveErrors).toMatchObject([
      { file: 'sketches/s/main.frag', line: 1, message: '파일 없음: "lib/later.glsl"' },
    ]);
  });

  it('hot-updates the Pass when the missing file is created', async () => {
    await server.transformRequest('/sketches/s/main.frag?import');
    const pass = await server.environments.client.moduleGraph.getModuleByUrl('/sketches/s/main.frag?import');
    const created = path.join(root, 'lib/later.glsl');
    fs.mkdirSync(path.dirname(created), { recursive: true });
    fs.writeFileSync(created, 'float later() { return 1.0; }\n');

    const plugin = server.environments.client.plugins.find((p) => p.name === 'shader-playground:shader') as Plugin;
    const hook = plugin.hotUpdate as (this: unknown, options: HotUpdateOptions) => unknown;
    const options = { type: 'create', file: created, timestamp: Date.now(), modules: [], read: () => '', server } as HotUpdateOptions;
    const modules = await hook.call({ environment: server.environments.client }, options);
    expect(modules).toContain(pass);
  });
});
