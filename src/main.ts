import { onShaderUpdate } from 'virtual:shader-hot';
import { createDiagnosticsBoard } from './diagnostics/board';
import { compileDiagnostics } from './diagnostics/compile';
import type { Diagnostic } from './diagnostics/diagnostic';
import { createClock } from './engine/clock';
import { createEngine } from './engine/engine';
import { createMouse, toRenderPixel } from './engine/mouse';
import { createRenderer } from './engine/renderer';
import { canvasLayout } from './output/layout';
import { effectiveRenderScale } from './output/output-size';
import { placeCanvas } from './output/place-canvas';
import { createOutputSettings } from './output/settings';
import { UNSUPPORTED_MESSAGE, hasFloatLinear, missingRequiredFeature } from './gl/features';
import { parameterPassOrder } from './params/merge';
import { createPassPipeline } from './params/pipeline';
import { browserStorage, createParameterValues, memoryStorage } from './params/values';
import { createRecordingSettings } from './recording/settings';
import type { ShaderSource } from './shader-source';
import { sketchConfigFile, sketchPassFiles } from './sketch/files';
import { buildPassGraph } from './sketch/graph';
import { sketchNames } from './sketch/pick';
import { browserSwitchPage, createSketchSwitch } from './sketch/switch';
import { mountBanner } from './ui/banner';
import { mountParameterPanel } from './ui/parameter-panel';
import { mountRecording } from './ui/recording';
import { bannerView } from './ui/banner-view';
import { mountBrowserUi } from './ui/browser-ui';
import { mountCapture } from './ui/capture';
import { mountOutputBadge } from './ui/output-badge';
import { mountOutputFolder } from './ui/output-folder';
import { mountSketchPicker } from './ui/sketch-picker';

// Vite needs literal globs. Every .frag is listed (subfolder ones only to warn about them); a
// module is only fetched when its Sketch is opened. Adding, removing or renaming a .frag or a
// sketch.ts, or editing a sketch.ts, changes these globs or modules that nothing accepts, so Vite
// reloads the page: that is the pass-graph rebuild and reset (#5 decision 9). A new Sketch folder
// reloads the same way; `plugins/sketch-watch.ts` announces it first so the reload opens it (#20).
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
  const renderer = createRenderer(gl);
  const engine = createEngine(renderer, createClock());

  // `?sketch=<name>` picks the Sketch and is written back (#20). Switching rewrites it and reloads.
  const names = sketchNames(Object.keys(fragModules));
  const sketchSwitch = createSketchSwitch(browserSwitchPage());
  const { name, notice } = sketchSwitch.open(names);
  if (name === null) return showMessage('sketches/ 폴더에 Sketch가 없습니다.');
  document.title = `${name} · shader playground`;

  // Every problem (compile, include, pass graph, Parameter declarations) goes through the
  // board to the banner. Compile, include and Parameter errors keep the last good program running.
  const diagnostics = createDiagnosticsBoard();
  const banner = mountBanner(document.body);
  // Reads isRunning() when notified, so producers must report after they change the engine.
  diagnostics.subscribe((all) => banner.render(bannerView(all, engine.isRunning())));
  // HUD, play bar, toasts and the keymap (#18). Later features mount into `ui.hud` regions,
  // add keys with `ui.keymap.add` and notify with `ui.toasts.show`.
  const ui = mountBrowserUi(document.body, engine);
  // Sketch name, palette, `[`/`]` and the switch to a new Sketch folder (#20).
  const picker = mountSketchPicker(document.body, ui, { names, current: name, sketchSwitch });
  if (notice !== null) ui.toasts.show(notice);

  const { passFiles, diagnostics: fileProblems } = sketchPassFiles(name, Object.keys(fragModules));
  const loaded = await loadSketchConfig(name);
  const built =
    loaded.diagnostics.length > 0
      ? { graph: null, diagnostics: [] }
      : buildPassGraph({ sketchFile: sketchConfigFile(name), passFiles, config: loaded.config, floatLinear: hasFloatLinear(gl) });
  engine.setGraph(built.graph);
  picker.setFeedback(engine.hasFeedback());
  if (built.graph?.title) document.title = `${built.graph.title} · shader playground`;
  diagnostics.report('graph', [...fileProblems, ...loaded.diagnostics, ...built.diagnostics]);

  // Parameters (#19): values per Sketch in localStorage, controls in the Tweakpane panel.
  const parameters = createParameterValues(name, browserStorage());
  const panel = mountParameterPanel(ui.hud.topRight, parameters);

  // Output size and render scale (#22), per Sketch in localStorage. Changing either changes the
  // composition, so the Sketch resets and its buffers are reallocated at the new size (ADR-0001).
  // Without a graph the sketch.ts default is unknown; don't let a choice made then overwrite the saved one.
  const output = createOutputSettings(name, built.graph ? browserStorage() : memoryStorage(), built.graph?.output);
  // A failed Output size Capture's banner depends on the size, so a new choice clears it too.
  output.subscribe(() => {
    engine.reset();
    diagnostics.report('capture', []);
  });
  mountOutputFolder(panel.pane, output, () => [canvas.width, canvas.height]);
  mountOutputBadge(ui.hud.topLeft, output);

  // Capture (#23, #24): `C`, `Shift+C` and the panel's Capture folder (after Output, as in #9).
  // Screen Capture is taken right after a frame is drawn; Output size Capture right before the
  // next one, from the frame on screen.
  const capture = mountCapture(ui, panel.pane, {
    sketch: name,
    renderer,
    parameters: () => parameters.list(),
    output: () => ({ output: output.output(), renderScale: effectiveRenderScale(output.output(), output.renderScale()) }),
    feedback: () => engine.hasFeedback(),
    reportError: (message) => diagnostics.report('capture', message === null ? [] : [{ severity: 'error', message }]),
  });

  // Recording (#43, #45): `V` or the panel's Recording folder (after Capture) starts and ends it.
  // The clock takes fixed steps meanwhile (ADR-0006) and each frame whose time advanced is encoded
  // right after it is drawn. The max length is kept per Sketch in localStorage.
  const recording = mountRecording(ui, {
    sketch: name,
    canvas,
    engine,
    pane: panel.pane,
    settings: createRecordingSettings(name, browserStorage()),
  });

  // Every Pass compiles, including ones that don't run, so their errors show too. Include and
  // Parameter errors block a Pass's new version like a compile failure does.
  const pipeline = createPassPipeline({
    passFiles,
    order: parameterPassOrder(Object.keys(passFiles), built.graph?.order ?? null),
    compile(pass, shader) {
      const result = engine.setShader(pass, shader);
      if (result.ok) return result;
      console.error(`[shader] ${shader.files[0]} failed to compile:\n${result.log}`);
      return { ok: false, diagnostics: compileDiagnostics(result.log, shader, result.prefixLines) };
    },
    report: (key, list) => diagnostics.report(key, list),
    onParameters: (list, options) => parameters.setParameters(list, options),
  });
  const shaders = await Promise.all(Object.entries(passFiles).map(async ([pass, file]) => [pass, await fragModules[`/${file}`]!()] as const));
  pipeline.update(shaders);
  onShaderUpdate((shader) => {
    const pass = Object.keys(passFiles).find((p) => passFiles[p] === shader.files[0]);
    if (pass !== undefined) pipeline.update([[pass, shader]]);
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
    // The encoder is behind: this animation frame draws nothing and time waits (#42 decision 9).
    if (!recording.ready()) {
      requestAnimationFrame(frame);
      return;
    }
    const layout = canvasLayout({
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      output: output.output(),
      renderScale: output.renderScale(),
    });
    placeCanvas(canvas, layout);
    const [width, height] = layout.render;
    // A paused Feedback Sketch isn't redrawn, so resizing would blank it; CSS stretches it
    // meanwhile. On play, the new size resamples the buffers, so the Feedback carries on.
    if ((canvas.width !== width || canvas.height !== height) && !engine.isFrozen()) {
      canvas.width = width;
      canvas.height = height;
    }
    // Before `engine.frame`, so an Output size Capture uses the frame on screen (#8 decision 6).
    capture.beforeFrame();
    const tick = engine.frame(now, { width, height, mouse: mouse.value(), parameters: parameters.uniforms() });
    ui.frame(tick, now);
    capture.frame();
    recording.frame(tick);
    mouse.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
