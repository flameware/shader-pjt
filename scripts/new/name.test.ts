import { describe, expect, it } from 'vitest';
import { normalizeSlug, sketchName } from './name.ts';

describe('normalizeSlug', () => {
  it('lowercases and turns spaces and underscores into hyphens', () => {
    expect(normalizeSlug('Soft Waves')).toBe('soft-waves');
    expect(normalizeSlug('soft_waves')).toBe('soft-waves');
  });

  it('drops characters outside [a-z0-9-], collapses and trims hyphens', () => {
    expect(normalizeSlug('  --Wave!!  #2__ -- ')).toBe('wave-2');
    expect(normalizeSlug('café-noir')).toBe('caf-noir');
  });

  it('is empty when nothing ASCII survives', () => {
    expect(normalizeSlug('파도')).toBe('');
    expect(normalizeSlug(' - _ ')).toBe('');
  });
});

describe('sketchName', () => {
  const none = () => false;

  it('is the local date, zero-padded, plus the slug', () => {
    expect(sketchName(new Date(2026, 0, 5, 0, 30), '', none)).toBe('2026-01-05');
    expect(sketchName(new Date(2026, 8, 28, 23, 59), 'waves', none)).toBe('2026-09-28-waves');
  });

  it('adds -2, -3, ... while the name is taken', () => {
    const taken = new Set(['2026-09-28-waves', '2026-09-28-waves-2', '2026-09-28']);
    const isTaken = (name: string) => taken.has(name);
    expect(sketchName(new Date(2026, 8, 28), 'waves', isTaken)).toBe('2026-09-28-waves-3');
    expect(sketchName(new Date(2026, 8, 28), '', isTaken)).toBe('2026-09-28-2');
  });
});
