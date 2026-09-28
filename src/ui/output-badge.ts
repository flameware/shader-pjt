import { type OutputSize, type RenderScale, outputKey } from '../output/output-size';
import type { OutputSettings } from '../output/settings';
import './output.css';

/** The badge text: `window`, `4:5`, `640x480`, plus ` full` when rendering at the Output size. */
export const outputBadgeText = (output: OutputSize, scale: RenderScale) => outputKey(output) + (scale === 'full' ? ' full' : '');

/** The Output size badge beside the Sketch name in the HUD's top-left (#9 decision 4). */
export function mountOutputBadge(container: HTMLElement, settings: OutputSettings): void {
  const badge = document.createElement('span');
  badge.className = 'output-badge';
  badge.title = 'Output size (패널의 Output 폴더에서 바꿉니다)';
  const render = () => (badge.textContent = outputBadgeText(settings.output(), settings.renderScale()));
  render();
  settings.subscribe(render);
  container.append(badge);
}
