import type { ButtonApi, Pane } from 'tweakpane';
import { type CaptureInput, captureImage } from '../capture/capture';
import type { CaptureKind } from '../capture/metadata';
import { NO_FRAME, type OutputAvailability, outputCaptureAvailability, takeOutputCapture } from '../capture/output-capture';
import type { SaveOutcome } from '../capture/save';
import type { CaptureRenderer } from '../engine/renderer';
import type { OutputSize, RenderScale } from '../output/output-size';
import type { Parameter } from '../params/values';
import type { BrowserUi } from './browser-ui';
import './capture.css';
import { captureToastView } from './capture-view';

const TOAST_MS = 6000;

export interface CaptureFolder {
  /** `📷 Output size` (`Shift+C`); disabled, with the reason as its tooltip, when it can't run now. */
  output: ButtonApi;
}

/**
 * The panel's **Capture** folder (#9 decision 5): `📷 화면` and `📷 Output size`. It joins the
 * Parameter panel's Pane, whose click handler already blurs its buttons (Space stays pause).
 */
function mountCaptureFolder(pane: Pane, actions: { screen(): void; output(): void }): CaptureFolder {
  const folder = pane.addFolder({ title: 'Capture' });
  folder.addButton({ title: '📷 화면', label: 'C' }).on('click', actions.screen);
  const output = folder.addButton({ title: '📷 Output size', label: '⇧C' });
  output.on('click', actions.output);
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

function resultToast(outcome: SaveOutcome, png: Blob, kind: CaptureKind): Node {
  const node = document.createElement('div');
  node.className = 'capture-toast';
  const thumbnail = document.createElement('img');
  const url = URL.createObjectURL(png);
  thumbnail.src = url;
  thumbnail.alt = '';
  setTimeout(() => URL.revokeObjectURL(url), TOAST_MS);
  const view = captureToastView(outcome, kind);
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

export interface CaptureOptions {
  sketch: string;
  renderer: Pick<CaptureRenderer, 'readMain' | 'lastFrame' | 'renderOffscreen'>;
  parameters(): readonly Parameter[];
  /** The Output size and (effective) render scale the frame is drawn at (#22). */
  output(): { output: OutputSize; renderScale: RenderScale };
  /** Whether the running Sketch has Feedback (`engine.hasFeedback`). */
  feedback(): boolean;
  /**
   * Shows why an Output size Capture failed on the device (size limits, `OUT_OF_MEMORY`, context
   * lost) in the banner, or clears it with `null`. Live rendering carries on either way.
   */
  reportError(message: string | null): void;
}

export interface Capture {
  /**
   * Call every animation frame before `engine.frame`: takes a requested Output size Capture of
   * the frame on screen before time advances (#8 decision 6).
   */
  beforeFrame(): void;
  /** Call every animation frame right after `engine.frame`; takes a requested screen Capture. */
  frame(): void;
  folder: CaptureFolder;
}

/**
 * Capture (#23, #24), saved as a PNG under `captures/<sketch>/` (or downloaded).
 *
 * - Screen Capture (`C`): the Main pass as shown, taken in the next animation frame right after
 *   it is drawn, so image, `iTime`/`iFrame`/`iMouse` and Parameters are one frame's.
 * - Output size Capture (`Shift+C`): the frame on screen at the Output size, taken in the next
 *   animation frame before time advances. A Sketch without Feedback is re-rendered off-screen;
 *   a Feedback Sketch is saved as shown, and only under `full` (ADR-0001).
 *
 * Both work while paused.
 */
export function mountCapture(ui: BrowserUi, pane: Pane, options: CaptureOptions): Capture {
  const availability = (): OutputAvailability => outputCaptureAvailability({ ...options.output(), feedback: options.feedback() });

  let screenPending = false;
  let outputPending = false;
  const requestScreen = () => void (screenPending = true);
  const requestOutput = () => {
    const current = availability();
    // The button is disabled then; the shortcut gives the same reason as its tooltip.
    if (!current.ok) return ui.toasts.show(current.reason);
    outputPending = true;
  };
  ui.keymap.add({ keys: ['C'], description: '화면 Capture', run: requestScreen });
  ui.keymap.add({ keys: ['Shift+C'], description: 'Output size Capture', run: requestOutput });
  const folder = mountCaptureFolder(pane, { screen: requestScreen, output: requestOutput });
  const flash = createFlash(document.body);

  let shownReason: string | null | undefined;
  const updateButton = () => {
    const current = availability();
    const reason = current.ok ? null : current.reason;
    if (reason === shownReason) return;
    shownReason = reason;
    folder.output.disabled = reason !== null;
    folder.output.element.title = reason ?? '같은 순간을 Output size로 저장 (Shift+C)';
  };
  updateButton();

  const save = (input: CaptureInput) => {
    flash();
    return captureImage(input).then(
      ({ outcome, png }) => ui.toasts.show(resultToast(outcome, png, input.kind), { durationMs: TOAST_MS }),
      (error: unknown) => {
        console.error('[capture] failed', error);
        ui.toasts.show(`Capture 실패: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
  };

  return {
    folder,

    beforeFrame() {
      updateButton();
      if (!outputPending) return;
      outputPending = false;
      const result = takeOutputCapture(availability(), options.renderer);
      if (!result.ok) {
        if (result.problem !== 'error') return ui.toasts.show(result.message);
        console.error('[capture] Output size Capture failed:', result.message);
        return options.reportError(`Output size Capture 실패: ${result.message}. 라이브 실행은 계속됩니다 (타일 렌더는 하지 않음)`);
      }
      options.reportError(null);
      void save({
        kind: 'output',
        sketch: options.sketch,
        image: result.image,
        frame: result.frame,
        feedback: options.feedback(),
        ...options.output(),
        parameters: options.parameters(),
      });
    },

    frame() {
      if (!screenPending) return;
      screenPending = false;
      const image = options.renderer.readMain();
      if (!image) {
        ui.toasts.show(NO_FRAME);
        return;
      }
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
