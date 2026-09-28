/** Shared notices for Capture results, Sketch switches and "can't do that" hints (#9 decisions 5, 8, 9). */
export interface Toasts {
  /**
   * Shows a notice in the bottom-right corner for `durationMs` (default 4 s). A string is shown
   * as plain text; pass a node for richer content such as a Capture thumbnail.
   */
  show(content: string | Node, options?: { durationMs?: number }): void;
}

const FADE_MS = 400;

/** Mounts the toast stack. It is outside the HUD, so notices show even with the HUD off. */
export function mountToasts(parent: HTMLElement): Toasts {
  const root = document.createElement('div');
  root.className = 'toasts';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  parent.append(root);

  return {
    show(content, { durationMs = 4000 } = {}) {
      const toast = document.createElement('div');
      toast.className = 'toast';
      if (typeof content === 'string') toast.textContent = content;
      else toast.append(content);
      root.append(toast);
      setTimeout(() => toast.classList.add('toast-leaving'), Math.max(durationMs - FADE_MS, 0));
      setTimeout(() => toast.remove(), durationMs);
    },
  };
}
