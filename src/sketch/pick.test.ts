import { describe, expect, it } from 'vitest';
import { pickSketch, sketchNames } from './pick';

describe('sketchNames', () => {
  it('reads Sketch names from their main.frag paths, sorted by name', () => {
    expect(
      sketchNames(['/sketches/2026-09-28-b/main.frag', '/sketches/2026-09-27/main.frag', '/sketches/2026-09-28/main.frag']),
    ).toEqual(['2026-09-27', '2026-09-28', '2026-09-28-b']);
  });
});

describe('pickSketch', () => {
  const names = ['2026-09-27', '2026-09-28', '2026-09-28-b'];

  it('opens the requested Sketch when it exists', () => {
    expect(pickSketch(names, '2026-09-27')).toBe('2026-09-27');
  });

  it('opens the latest Sketch (last by name) when none is requested', () => {
    expect(pickSketch(names, null)).toBe('2026-09-28-b');
  });

  it('opens the latest Sketch when the requested one does not exist', () => {
    expect(pickSketch(names, 'nope')).toBe('2026-09-28-b');
  });

  it('opens nothing when there are no Sketches', () => {
    expect(pickSketch([], null)).toBeNull();
  });
});
