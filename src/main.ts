import { onShaderUpdate } from 'virtual:shader-hot';
import { createClock } from './engine/clock';
import { createMouse, toRenderPixel } from './engine/mouse';
import { createRenderer, type SwapResult } from './engine/renderer';
import { renderSize } from './engine/resolution';
import { UNSUPPORTED_MESSAGE, missingRequiredFeature } from './gl/features';
import type { ShaderSource } from './shader-source';
import { pickSketch, sketchNames } from './sketch/pick';

const mainPasses = import.meta.glob<ShaderSource>('/sketches/*/main.frag', { import: 'default' });

/** Replaces the canvas with a plain-text message and stops. */
function showMessage(text: string): void {
  const message = document.createElement('p');
  message.className = 'message';
  message.textContent = text;
  document.body.replaceChildren(message);
}

/** Until the error banner lands (#15), compile errors go to the console. */
function reportSwap(file: string, result: SwapResult): void {
  if (!result.ok) console.error(`[shader] ${file} failed to compile (${result.prefixLines} engine lines precede the body):\n${result.log}`);
}

async function start(): Promise<void> {
  const canvas = document.querySelector('canvas')!;
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
  if (gl === null || missingRequiredFeature(gl) !== null) return showMessage(UNSUPPORTED_MESSAGE);
  const renderer = createRenderer(gl);

  const name = pickSketch(sketchNames(Object.keys(mainPasses)), new URLSearchParams(location.search).get('sketch'));
  if (name === null) return showMessage('sketches/ 폴더에 Sketch가 없습니다.');
  document.title = `${name} · shader playground`;

  const mainFile = `sketches/${name}/main.frag`;
  reportSwap(mainFile, renderer.setShader(await mainPasses[`/${mainFile}`]!()));
  onShaderUpdate((shader) => {
    if (shader.files[0] === mainFile) reportSwap(mainFile, renderer.setShader(shader));
  });

  const mouse = createMouse();
  const pixel = (e: PointerEvent) =>
    toRenderPixel(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas.width, canvas.height);
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    mouse.press(...pixel(e));
  });
  canvas.addEventListener('pointermove', (e) => mouse.move(...pixel(e)));
  canvas.addEventListener('pointerup', () => mouse.release());
  canvas.addEventListener('pointercancel', () => mouse.release());

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
