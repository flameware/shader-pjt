import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSketch, NewSketchError } from './create.ts';

let root: string;
const now = new Date(2026, 8, 28, 10, 0);

function write(path: string, text = path): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

/** Every file under `dir`, relative to it, sorted. */
function filesIn(dir: string): string[] {
  return readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(join(root, dir), join(entry.parentPath, entry.name)))
    .sort();
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'new-sketch-'));
  write('templates/default/main.frag', 'default main');
  write('templates/feedback/main.frag', 'feedback main');
  write('templates/feedback/sketch.ts', 'feedback sketch');
  write('templates/feedback/notes/idea.txt');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('createSketch from a Template', () => {
  it('copies the Template folder as is into sketches/<date-slug>/', () => {
    const created = createSketch(root, { slug: 'trails', start: { template: 'feedback' } }, now);

    expect(created.name).toBe('2026-09-28-trails');
    expect(created.dir).toBe(join(root, 'sketches/2026-09-28-trails'));
    expect(created.mainFile).toBe(join(root, 'sketches/2026-09-28-trails/main.frag'));
    expect(filesIn('sketches/2026-09-28-trails')).toEqual(['main.frag', 'notes/idea.txt', 'sketch.ts']);
    expect(readFileSync(created.mainFile, 'utf8')).toBe('feedback main');
  });

  it('does not reuse a taken name', () => {
    write('sketches/2026-09-28/main.frag');
    write('sketches/2026-09-28-2/main.frag');

    expect(createSketch(root, { slug: '', start: { template: 'default' } }, now).name).toBe('2026-09-28-3');
    expect(createSketch(root, { slug: '', start: { template: 'default' } }, now).name).toBe('2026-09-28-4');
  });

  it('rejects an unknown Template, listing the ones there are, and creates nothing', () => {
    expect(() => createSketch(root, { slug: '', start: { template: 'nope' } }, now)).toThrow(NewSketchError);
    expect(() => createSketch(root, { slug: '', start: { template: '../templates/default' } }, now)).toThrow(/default, feedback/);
    expect(readdirSync(root)).toEqual(['templates']);
  });
});

describe('createSketch --from', () => {
  beforeEach(() => {
    write('sketches/2026-09-27-waves/main.frag', 'waves main');
    write('sketches/2026-09-27-waves/blur.frag');
    write('sketches/2026-09-27-waves/common.glsl');
    write('sketches/2026-09-27-waves/shapes/circle.glsl');
    write('sketches/2026-09-27-waves/sketch.ts');
    write('sketches/2026-09-27-waves/helper.ts');
    write('sketches/2026-09-27-waves/notes.md');
    write('sketches/2026-09-27-waves/captures/frame.png');
    write('sketches/2026-09-26/main.frag', 'older main');
    write('sketches/2026-09-29-scratch/notes.md'); // no main.frag: not a Sketch
  });

  it('copies only the source files of the named Sketch, keeping subfolders', () => {
    const created = createSketch(root, { slug: 'waves', start: { from: '2026-09-27-waves' } }, now);

    expect(created.name).toBe('2026-09-28-waves');
    expect(filesIn('sketches/2026-09-28-waves')).toEqual(['blur.frag', 'common.glsl', 'main.frag', 'shapes/circle.glsl', 'sketch.ts']);
  });

  it('copies the latest Sketch (last by name) when no name is given, without its slug', () => {
    const created = createSketch(root, { slug: '', start: { from: null } }, now);

    expect(created.name).toBe('2026-09-28');
    expect(readFileSync(created.mainFile, 'utf8')).toBe('waves main');
  });

  it('rejects a Sketch that does not exist', () => {
    expect(() => createSketch(root, { slug: '', start: { from: '2026-09-29-scratch' } }, now)).toThrow(NewSketchError);
    expect(() => createSketch(root, { slug: '', start: { from: '../templates/default' } }, now)).toThrow(/없습니다/);
  });

  it('rejects --from when there is no Sketch yet', () => {
    rmSync(join(root, 'sketches'), { recursive: true });
    expect(() => createSketch(root, { slug: '', start: { from: null } }, now)).toThrow(NewSketchError);
  });
});
