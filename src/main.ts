import { onShaderUpdate } from 'virtual:shader-hot';
import { createDiagnosticsBoard } from './diagnostics/board';
import { compileDiagnostics } from './diagnostics/compile';
import { createClock } from './engine/clock';
import { createMouse, toRenderPixel } from './engine/mouse';
import { createRenderer } from './engine/renderer';
import { renderSize } from './engine/render-size';
import { UNSUPPORTED_MESSAGE, missingRequiredFeature } from './gl/features';
import type { ShaderSource } from './shader-source';
import { mainPassFile, pickSketch, sketchNames } from './sketch/pick';
import { mountBanner } from './ui/banner';
import { bannerView } from './ui/banner-view';

// Vite needs a literal glob; keep it in step with mainPassFile().
const mainPasses = import.meta.glob<ShaderSource>('/sketches/*/main.frag', { import: 'default' });

/** Replaces the canvas with a plain-text message and stops. */
function showMessage(text: string): void {
  const message = document.createElement('p');
  message.className = 'message';
  message.textContent = text;
  document.body.replaceChildren(message);
}

async function start(): Promise<void> {
  const canvas = document.querySelector('canvas')!;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
  if (gl === null || missingRequiredFeature(gl) !== null) return showMessage(UNSUPPORTED_MESSAGE);
  const renderer = createRenderer(gl);

  const name = pickSketch(sketchNames(Object.keys(mainPasses)), new URLSearchParams(location.search).get('sketch'));
  if (name === null) return showMessage('sketches/ 폴더에 Sketch가 없습니다.');
  document.title = `${name} · shader playground`;

  // Every problem (compile now; include, Parameter and pass-graph checks later) goes through
  // the board to the banner. Compile failures keep the last good program running.
  const diagnostics = createDiagnosticsBoard();
  const banner = mountBanner(document.body);
  // Reads hasProgram() when notified, so producers must report after they swap the program.
  diagnostics.subscribe((all) => banner.render(bannerView(all, renderer.hasProgram())));

  const mainFile = mainPassFile(name);
  const applyShader = (shader: ShaderSource) => {
    // An include that doesn't resolve blocks the new version like a compile failure does.
    // Its compile errors (if any) belonged to an older version, so they are cleared.
    const resolveErrors = shader.resolveErrors ?? [];
    diagnostics.report(`include:${mainFile}`, resolveErrors);
    if (resolveErrors.length > 0) return diagnostics.report(`compile:${mainFile}`, []);
    const result = renderer.setShader(shader);
    if (!result.ok) console.error(`[shader] ${mainFile} failed to compile:\n${result.log}`);
    diagnostics.report(`compile:${mainFile}`, result.ok ? [] : compileDiagnostics(result.log, shader, result.prefixLines));
  };
  applyShader(await mainPasses[`/${mainFile}`]!());
  onShaderUpdate((shader) => {
    if (shader.files[0] === mainFile) applyShader(shader);
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

  const clock = createClock();
  const frame = (now: number) => {
    const [width, height] = renderSize(canvas.clientWidth, canvas.clientHeight, devicePixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    renderer.draw({ ...clock.tick(now), width, height, mouse: mouse.value() });
    mouse.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
