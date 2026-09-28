import { describe, expect, it } from 'vitest';
import { renderSize } from './render-size';

describe('renderSize', () => {
  it('multiplies the CSS size by devicePixelRatio', () => {
    expect(renderSize(800, 600, 1.5)).toEqual([1200, 900]);
  });

  it('caps devicePixelRatio at 2', () => {
    expect(renderSize(800, 600, 3)).toEqual([1600, 1200]);
  });

  it('rounds to whole pixels and never goes below 1', () => {
    expect(renderSize(333, 0, 1.25)).toEqual([416, 1]);
  });
});
