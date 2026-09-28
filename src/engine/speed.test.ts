import { describe, expect, it } from 'vitest';
import { faster, slower } from './speed';

describe('speed steps (0.1 · 0.25 · 0.5 · 1 · 2 · 4×)', () => {
  it('faster goes to the next step up and stops at 4×', () => {
    expect([0.1, 0.25, 0.5, 1, 2, 4].map(faster)).toEqual([0.25, 0.5, 1, 2, 4, 4]);
  });

  it('slower goes to the next step down and stops at 0.1×', () => {
    expect([0.1, 0.25, 0.5, 1, 2, 4].map(slower)).toEqual([0.1, 0.1, 0.25, 0.5, 1, 2]);
  });

  it('a speed between steps moves to the nearest step in that direction', () => {
    expect([faster(0.3), slower(0.3)]).toEqual([0.5, 0.25]);
  });
});
