import { describe, expect, it } from 'vitest';
import { neighbourSketch, sketchUrl } from './navigate';

describe('neighbourSketch', () => {
  const names = ['2026-09-26', '2026-09-27', '2026-09-28'];

  it('] goes to the next Sketch by name, [ to the previous', () => {
    expect(neighbourSketch(names, '2026-09-27', 1)).toBe('2026-09-28');
    expect(neighbourSketch(names, '2026-09-27', -1)).toBe('2026-09-26');
  });

  it('wraps around at both ends', () => {
    expect(neighbourSketch(names, '2026-09-28', 1)).toBe('2026-09-26');
    expect(neighbourSketch(names, '2026-09-26', -1)).toBe('2026-09-28');
  });

  it('stays put when there is only one Sketch', () => {
    expect(neighbourSketch(['2026-09-28'], '2026-09-28', 1)).toBe('2026-09-28');
  });
});

describe('sketchUrl', () => {
  it('sets ?sketch=<name>', () => {
    expect(sketchUrl('http://localhost:5173/', '2026-09-28-waves')).toBe('http://localhost:5173/?sketch=2026-09-28-waves');
  });

  it('replaces an existing ?sketch and keeps other query parameters and the hash', () => {
    expect(sketchUrl('http://localhost:5173/?debug=1&sketch=old#x', '2026-09-28')).toBe(
      'http://localhost:5173/?debug=1&sketch=2026-09-28#x',
    );
  });
});
