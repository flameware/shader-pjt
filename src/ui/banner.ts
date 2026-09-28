import type { BannerEntry, BannerView } from './banner-view';

/** The mounted banner element; `render(null)` hides it. */
export interface Banner {
  render(view: BannerView | null): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function list(kind: 'error' | 'warning', entries: BannerEntry[]): HTMLElement {
  const ul = el('ul', `banner-list banner-${kind}s`);
  for (const { location, message, sourceLine } of entries) {
    const li = el('li', `banner-item banner-${kind}`);
    li.append(el('span', 'banner-label', kind === 'error' ? 'ERROR' : 'WARNING'));
    if (location) li.append(el('span', 'banner-location', location));
    li.append(el('span', 'banner-message', message));
    if (sourceLine) li.append(el('code', 'banner-code', sourceLine));
    ul.append(li);
  }
  return ul;
}

/**
 * The top-centre banner (#9 decision 7). It sits outside the HUD and is never auto-hidden:
 * it stays until the diagnostics that fill it are cleared.
 */
export function mountBanner(parent: HTMLElement): Banner {
  const root = el('div', 'banner');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.hidden = true;
  parent.append(root);

  return {
    render(view) {
      root.hidden = view === null;
      if (view === null) return root.replaceChildren();
      const parts: HTMLElement[] = [];
      if (view.errors.length > 0) parts.push(list('error', view.errors));
      if (view.status) parts.push(el('p', 'banner-status', view.status));
      if (view.warnings.length > 0) parts.push(list('warning', view.warnings));
      root.replaceChildren(...parts);
    },
  };
}
