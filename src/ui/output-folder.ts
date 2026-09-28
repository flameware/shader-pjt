import type { Pane } from 'tweakpane';
import { isRenderScale, outputKey, outputLabel } from '../output/output-size';
import type { OutputSettings } from '../output/settings';

/**
 * The **Output** folder of the Tweakpane panel (#9 decision 5), collapsed by default: the Output
 * size, render scale `fit`/`full` (disabled for `window`, which is always `fit`) and the current
 * `iResolution`, read from `renderSize` (the working resolution actually rendered).
 */
export function mountOutputFolder(pane: Pane, settings: OutputSettings, renderSize: () => readonly [number, number]): void {
  const folder = pane.addFolder({ title: 'Output', expanded: false });
  const options = settings.options();
  // Tweakpane compares list values with ===, so the dropdown works on keys, not `[w, h]` arrays.
  const state = {
    get output() {
      return outputKey(settings.output());
    },
    set output(key: string) {
      const choice = options.find((o) => outputKey(o) === key);
      if (choice !== undefined) settings.setOutput(choice);
    },
    get renderScale(): string {
      return settings.renderScale();
    },
    set renderScale(scale: string) {
      if (isRenderScale(scale)) settings.setRenderScale(scale);
    },
    get iResolution() {
      const [w, h] = renderSize();
      return `${w}×${h}`;
    },
  };

  folder.addBinding(state, 'output', {
    label: 'Output size',
    options: Object.fromEntries(options.map((o) => [outputLabel(o), outputKey(o)])),
  });
  const scale = folder.addBinding(state, 'renderScale', { label: 'render scale', options: { fit: 'fit', full: 'full' } });
  // A read-only binding is polled, so it follows window resizes without being told.
  folder.addBinding(state, 'iResolution', { readonly: true });

  const sync = () => {
    scale.disabled = settings.output() === 'window';
    pane.refresh();
  };
  sync();
  settings.subscribe(sync);
}
