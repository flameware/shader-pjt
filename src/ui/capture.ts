import type { ButtonApi, Pane } from 'tweakpane';
import { type CaptureInput, captureImage } from '../capture/capture';
import type { SaveOutcome } from '../capture/save';
import type { MainImage } from '../engine/renderer';
import type { OutputSize, RenderScale } from '../output/output-size';
import type { Parameter } from '../params/values';
import type { BrowserUi } from './browser-ui';
import './capture.css';
import { captureToastView } from './capture-view';

const TOAST_MS = 6000;

export interface CaptureFolder {
  /** `📷 Output size` (`Shift+C`); disabled until Output size Capture exists (#24). */
  output: ButtonApi;
}

/**
 * The panel's **Capture** folder (#9 decision 5): `📷 화면` and `📷 Output size`. It joins the
 * Parameter panel's Pane, whose click handler already blurs its buttons (Space stays pause).
 */
function mountCaptureFolder(pane: Pane, actions: { screen(): void }): CaptureFolder {
  const folder = pane.addFolder({ title: 'Capture' });
  folder.addButton({ title: '📷 화면', label: 'C' }).on('click', actions.screen);
  const output = folder.addButton({ title: '📷 Output size', label: '⇧C', disabled: true });
  output.element.title = 'Output size Capture는 아직 준비 중입니다';
  return { output };
}

/** The whole screen flashes white for a moment (#9 decision 8). Outside the HUD, so it shows with the HUD off. */
function createFlash(parent: HTMLElement): () => void {
  const flash = document.createElement('div');
  flash.className = 'capture-flash';
  parent.append(flash);
  return () => {
    flash.classList.remove('capture-flash-go');
    void flash.offsetWidth; // restart the animation
    flash.classList.add('capture-flash-go');
  };
}

function resultToast(outcome: SaveOutcome, png: Blob): Node {
  const node = document.createElement('div');
  node.className = 'capture-toast';
  const thumbnail = document.createElement('img');
  const url = URL.createObjectURL(png);
  thumbnail.src = url;
  thumbnail.alt = '';
  setTimeout(() => URL.revokeObjectURL(url), TOAST_MS);
  const view = captureToastView(outcome);
  const text = document.createElement('div');
  const title = document.createElement('b');
  title.textContent = view.title;
  const where = document.createElement('span');
  where.className = 'capture-toast-path';
  where.textContent = view.where;
  text.append(title, document.createElement('br'), where);
  node.append(thumbnail, text);
  return node;
}

export interface ScreenCaptureOptions {
  sketch: string;
  /** `renderer.readMain`. */
  readMain(): MainImage | null;
  parameters(): readonly Parameter[];
  /** The Output size and (effective) render scale the frame is drawn at (#22). */
  output(): { output: OutputSize; renderScale: RenderScale };
}

export interface ScreenCapture {
  /** Call every animation frame right after `engine.frame`; takes a requested Capture. */
  frame(): void;
  folder: CaptureFolder;
}

/**
 * Screen Capture (`C`, #23): the Main pass as shown, saved as a PNG under `captures/<sketch>/`
 * (or downloaded). A request is taken in the next animation frame, right after it is drawn,
 * so the image, `iTime`/`iFrame`/`iMouse` and Parameters are one frame's. Works while paused.
 */
export function mountScreenCapture(ui: BrowserUi, pane: Pane, options: ScreenCaptureOptions): ScreenCapture {
  let pending = false;
  const request = () => void (pending = true);
  ui.keymap.add({ keys: ['C'], description: '화면 Capture', run: request });
  const folder = mountCaptureFolder(pane, { screen: request });
  const flash = createFlash(document.body);

  const save = (input: CaptureInput) =>
    captureImage(input).then(
      ({ outcome, png }) => ui.toasts.show(resultToast(outcome, png), { durationMs: TOAST_MS }),
      (error: unknown) => {
        console.error('[capture] failed', error);
        ui.toasts.show(`Capture 실패: ${error instanceof Error ? error.message : String(error)}`);
      },
    );

  return {
    folder,
    frame() {
      if (!pending) return;
      pending = false;
      const image = options.readMain();
      if (!image) {
        ui.toasts.show('Capture할 프레임이 아직 없습니다 (컴파일된 버전이 없음)');
        return;
      }
      flash();
      void save({
        kind: 'screen',
        sketch: options.sketch,
        image,
        frame: image.frame,
        feedback: image.feedback,
        ...options.output(),
        parameters: options.parameters(),
      });
    },
  };
}
