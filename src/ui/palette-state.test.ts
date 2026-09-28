import { describe, expect, it } from 'vitest';
import { createPaletteState, filterSketches } from './palette-state';

const names = ['2026-09-10-first', '2026-09-24-rings', '2026-09-27-waves', '2026-09-28-flow'];

describe('filterSketches', () => {
  it('lists every Sketch, newest first, for an empty query', () => {
    expect(filterSketches(names, '')).toEqual(['2026-09-28-flow', '2026-09-27-waves', '2026-09-24-rings', '2026-09-10-first']);
  });

  it('keeps the Sketches whose name contains the query, ignoring case and surrounding spaces', () => {
    expect(filterSketches(names, ' WAV ')).toEqual(['2026-09-27-waves']);
    expect(filterSketches(names, '09-2')).toEqual(['2026-09-28-flow', '2026-09-27-waves', '2026-09-24-rings']);
  });

  it('needs every space-separated word to match', () => {
    expect(filterSketches(names, '27 wav')).toEqual(['2026-09-27-waves']);
    expect(filterSketches(names, '28 wav')).toEqual([]);
  });

  it('also matches letters in order with gaps, ranked after plain matches', () => {
    // "fw" is in no name as is; "flow" has f…w. "rs" is in "first" and, with a gap, in "rings".
    expect(filterSketches(names, 'fw')).toEqual(['2026-09-28-flow']);
    expect(filterSketches(names, 'rs')).toEqual(['2026-09-10-first', '2026-09-24-rings']);
  });

  it('matches nothing when the letters are not all there in order', () => {
    expect(filterSketches(names, 'zz')).toEqual([]);
    expect(filterSketches(names, 'wolf')).toEqual([]);
  });
});

describe('palette selection', () => {
  it('opens with the current Sketch selected and marked', () => {
    const palette = createPaletteState(names, '2026-09-24-rings');
    expect(palette.view()).toEqual({
      items: [
        { name: '2026-09-28-flow', current: false },
        { name: '2026-09-27-waves', current: false },
        { name: '2026-09-24-rings', current: true },
        { name: '2026-09-10-first', current: false },
      ],
      selected: 2,
    });
    expect(palette.chosen()).toBe('2026-09-24-rings');
  });

  it('typing filters the list and selects the best match', () => {
    const palette = createPaletteState(names, '2026-09-24-rings');
    palette.setQuery('rs');
    expect(palette.view().items.map((item) => item.name)).toEqual(['2026-09-10-first', '2026-09-24-rings']);
    expect(palette.chosen()).toBe('2026-09-10-first');
  });

  it('clearing the query selects the current Sketch again', () => {
    const palette = createPaletteState(names, '2026-09-24-rings');
    palette.setQuery('flow');
    palette.setQuery('');
    expect(palette.chosen()).toBe('2026-09-24-rings');
  });

  it('↑↓ move the selection and stop at the ends', () => {
    const palette = createPaletteState(names, '2026-09-27-waves');
    palette.move(1);
    expect(palette.chosen()).toBe('2026-09-24-rings');
    palette.move(1);
    palette.move(1);
    expect(palette.chosen()).toBe('2026-09-10-first');
    palette.move(-1);
    palette.move(-1);
    palette.move(-1);
    palette.move(-1);
    expect(palette.chosen()).toBe('2026-09-28-flow');
  });

  it('chooses nothing when nothing matches, and arrows do not change that', () => {
    const palette = createPaletteState(names, '2026-09-27-waves');
    palette.setQuery('zz');
    palette.move(1);
    expect(palette.view()).toEqual({ items: [], selected: -1 });
    expect(palette.chosen()).toBeNull();
  });

  it('select() picks a row by index, as hovering or clicking it does', () => {
    const palette = createPaletteState(names, '2026-09-27-waves');
    palette.select(3);
    expect(palette.chosen()).toBe('2026-09-10-first');
  });
});
