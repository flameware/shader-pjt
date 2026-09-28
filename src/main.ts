import { onShaderUpdate } from 'virtual:shader-hot';
import { createDiagnosticsBoard } from './diagnostics/board';
import { compileDiagnostics } from './diagnostics/compile';
import type { Diagnostic } from './diagnostics/diagnostic';
import { createClock } from './engine/clock';
import { createEngine } from './engine/engine';
import { createMouse, toRenderPixel } from './engine/mouse';
import { createRenderer } from './engine/renderer';
import { renderSize } from './engine/render-size';
import { UNSUPPORTED_MESSAGE, hasFloatLinear, missingRequiredFeature } from './gl/features';
import type { ShaderSource } from './shader-source';
import { sketchConfigFile, sketchPassFiles } from './sketch/files';
import { buildPassGraph } from './sketch/graph';
import { pickSketch, sketchNames } from './sketch/pick';
import { mountBanner } from './ui/banner';
import { bannerView } from './ui/banner-view';

// Vite needs literal globs. Every .frag is listed (subfolder ones only to warn about them); a
// module is only fetched when its Sketch is opened. Adding, removing or renaming a .frag or a
// sketch.ts, or editing a sketch.ts, changes these globs or modules that nothing accepts, so Vite
// reloads the page: that is the pass-graph rebuild and reset (#5 decision 9).
const fragModules = import.meta.glob<ShaderSource>('/sketches/**/*.frag', { import: 'default' });
const sketchModules = import.meta.glob<Record<string, unknown>>('/sketches/*/sketch.ts');

/** Replaces the canvas with a plain-text message and stops. */
function showMessage(text: string): void {
  const message = document.createElement('p');
  message.className = 'message';
  message.textContent = text;
  document.body.replaceChildren(message);
}

/** The default export of the Sketch's `sketch.ts`: `undefined` without one, `null` when it has no default export. */
async function loadSketchConfig(name: string): Promise<{ config: unknown; diagnostics: Diagnostic[] }> {
  const file = sketchConfigFile(name);
  const load = sketchModules[`/${file}`];
  if (!load) return { config: undefined, diagnostics: [] };
  try {
    const module = await load();
    return { config: 'default' in module ? module.default : null, diagnostics: [] };
  } catch (error) {
    const message = `sketch.ts를 불러오지 못했습니다: ${error instanceof Error ? error.message : String(error)}`;
    return { config: undefined, diagnostics: [{ severity: 'error', file, message }] };
  }
}

async function start(): Promise<void> {
  const canvas = document.querySelector('canvas')!;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
  if (gl === null || missingRequiredFeature(gl) !== null) return showMessage(UNSUPPORTED_MESSAGE);
  const engine = createEngine(createRenderer(gl), createClock());

  const name = pickSketch(sketchNames(Object.keys(fragModules)), new URLSearchParams(location.search).get('sketch'));
  if (name === null) return showMessage('sketches/ 폴더에 Sketch가 없습니다.');
  document.title = `${name} · shader playground`;

  // Every problem (compile, include, pass graph; Parameter checks later) goes through the
  // board to the banner. Compile and include failures keep the last good program running.
  const diagnostics = createDiagnosticsBoard();
  const banner = mountBanner(document.body);
  // Reads isRunning() when notified, so producers must report after they change the engine.
  diagnostics.subscribe((all) => banner.render(bannerView(all, engine.isRunning())));

  const { passFiles, diagnostics: fileProblems } = sketchPassFiles(name, Object.keys(fragModules));
  const loaded = await loadSketchConfig(name);
  const built =
    loaded.diagnostics.length > 0
      ? { graph: null, diagnostics: [] }
      : buildPassGraph({ sketchFile: sketchConfigFile(name), passFiles, config: loaded.config, floatLinear: hasFloatLinear(gl) });
  engine.setGraph(built.graph);
  if (built.graph?.title) document.title = `${built.graph.title} · shader playground`;
  diagnostics.report('graph', [...fileProblems, ...loaded.diagnostics, ...built.diagnostics]);

  // Every Pass compiles, including ones that don't run, so their errors show too.
  const applyShader = (pass: string, shader: ShaderSource) => {
    const file = shader.files[0]!;
    // An include that doesn't resolve blocks the new version like a compile failure does.
    // Its compile errors (if any) belonged to an older version, so they are cleared.
    const resolveErrors = shader.resolveErrors ?? [];
    diagnostics.report(`include:${file}`, resolveErrors);
    if (resolveErrors.length > 0) {
      diagnostics.report(`compile:${file}`, []);
      return;
    }
    const result = engine.setShader(pass, shader);
    if (!result.ok) console.error(`[shader] ${file} failed to compile:\n${result.log}`);
    diagnostics.report(`compile:${file}`, result.ok ? [] : compileDiagnostics(result.log, shader, result.prefixLines));
  };
  const shaders = await Promise.all(Object.entries(passFiles).map(async ([pass, file]) => [pass, await fragModules[`/${file}`]!()] as const));
  for (const [pass, shader] of shaders) applyShader(pass, shader);
  onShaderUpdate((shader) => {
    const pass = Object.keys(passFiles).find((p) => passFiles[p] === shader.files[0]);
    if (pass !== undefined) applyShader(pass, shader);
  });

  const mouse = createMouse();
  const pixel = (e: PointerEvent) =>
    toRenderPixel(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height);
  // Only the primary pointer drives iMouse, so a second touch can't move the click position.
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    mouse.press(...pixel(e));
  });
  canvas.addEventListener('pointermove', (e) => e.isPrimary && mouse.move(...pixel(e)));
  canvas.addEventListener('pointerup', (e) => e.isPrimary && mouse.release());
  canvas.addEventListener('pointercancel', (e) => e.isPrimary && mouse.release());

  const frame = (now: number) => {
    const [width, height] = renderSize(canvas.clientWidth, canvas.clientHeight, devicePixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    engine.frame(now, { width, height, mouse: mouse.value() });
    mouse.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
