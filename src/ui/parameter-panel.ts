import { type BindingParams, type ButtonApi, type FolderApi, Pane } from 'tweakpane';
import type { ParamSpec, ParamValue } from '../params/annotation';
import type { ParameterValues } from '../params/values';

/** Tweakpane options for one Parameter: slider, integer slider, checkbox, color picker, 2D pad, dropdown. */
function bindingParams(label: string, spec: ParamSpec): BindingParams {
  switch (spec.kind) {
    case 'float':
      return { label, min: spec.min, max: spec.max, step: spec.step };
    case 'int':
      return { label, min: spec.min, max: spec.max, step: spec.step ?? 1 };
    case 'bool':
      return { label };
    case 'color':
      return { label, view: 'color', color: { alpha: spec.alpha } };
    case 'vec2': {
      const axis = { min: spec.min, max: spec.max, step: spec.step };
      // y up, like gl_FragCoord.
      return { label, x: axis, y: { ...axis, inverted: true }, picker: 'inline', expanded: true };
    }
    case 'select':
      return { label, options: Object.fromEntries(spec.options.map((o) => [o, o])) };
  }
}

/** Tweakpane edits vec2 as `{x, y}`; everything else is bound as it is stored. */
const toPane = (value: ParamValue | undefined): unknown => (Array.isArray(value) ? { x: value[0], y: value[1] } : value);
const fromPane = (value: unknown): ParamValue => {
  if (typeof value === 'object' && value !== null && 'x' in value && 'y' in value) return [Number(value.x), Number(value.y)];
  return value as ParamValue;
};

function flash(button: ButtonApi, title: string, restore: string): void {
  button.title = title;
  setTimeout(() => (button.title = restore), 1200);
}

function fill(folder: FolderApi, values: ParameterValues): void {
  for (const child of [...folder.children]) folder.remove(child);
  const parameters = values.list();
  if (parameters.length === 0) {
    folder.addBlade({ view: 'text', label: '', parse: (v: string) => v, value: '(Parameter 없음)', disabled: true });
    return;
  }
  // One property per Parameter, read and written through the store, so the store stays the truth.
  const target: Record<string, unknown> = {};
  for (const { name, spec } of parameters) {
    Object.defineProperty(target, name, {
      enumerable: true,
      get: () => toPane(values.get(name)),
      set: (value: unknown) => values.set(name, fromPane(value)),
    });
    folder.addBinding(target, name, bindingParams(name, spec));
  }
  folder.addButton({ title: '기본값으로' }).on('click', () => values.resetAll());
  const copy = folder.addButton({ title: '현재 값 복사' });
  copy.on('click', () => {
    navigator.clipboard.writeText(values.copyText()).then(
      () => flash(copy, '복사됨', '현재 값 복사'),
      (error: unknown) => {
        console.error('[params] clipboard write failed', error);
        flash(copy, '복사 실패', '현재 값 복사');
      },
    );
  });
}

const isTextBox = (node: HTMLElement) => node instanceof HTMLInputElement && node.type === 'text';

export interface ParameterPanel {
  /** The Tweakpane root, so later folders (Output, Capture) can join the same panel. */
  pane: Pane;
  dispose(): void;
}

/**
 * The Tweakpane panel with the **Parameters** folder (#6, #9): one flat list of controls, then
 * "기본값으로" and "현재 값 복사". It follows `values`: the controls are rebuilt when the
 * Parameter list changes (a hot swap that adds or changes a declaration) and refreshed when only
 * values change. `container` is the HUD's top-right region (#18).
 */
export function mountParameterPanel(container: HTMLElement, values: ParameterValues): ParameterPanel {
  const pane = new Pane({ container });
  // A clicked button, checkbox or dropdown keeps focus, and then Space would press it again as
  // well as toggling pause (#18's keymap only skips text entry). Text boxes keep focus for typing.
  const release = () => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && pane.element.contains(focused) && !isTextBox(focused)) focused.blur();
  };
  pane.element.addEventListener('click', release);
  pane.element.addEventListener('change', release);
  const folder = pane.addFolder({ title: 'Parameters' });
  fill(folder, values);
  const unsubscribe = values.subscribe(({ listChanged }) => (listChanged ? fill(folder, values) : pane.refresh()));
  return {
    pane,
    dispose() {
      unsubscribe();
      pane.dispose();
    },
  };
}
