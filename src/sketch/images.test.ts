import { describe, expect, it } from 'vitest';
import { isImageSource, resolveImagePath } from './images';

describe('isImageSource', () => {
  it('is true for relative paths, which Pass names can never be', () => {
    expect(isImageSource('./density.png')).toBe(true);
    expect(isImageSource('../other/x.png')).toBe(true);
    expect(isImageSource('blur')).toBe(false);
    expect(isImageSource('density.png')).toBe(false);
  });
});

describe('resolveImagePath', () => {
  const folder = 'sketches/s';

  it('resolves against the Sketch folder, subfolders included', () => {
    expect(resolveImagePath(folder, './density.png')).toEqual({ ok: true, path: 'sketches/s/density.png' });
    expect(resolveImagePath(folder, './images/./a.jpg')).toEqual({ ok: true, path: 'sketches/s/images/a.jpg' });
    expect(resolveImagePath(folder, './images/../a.webp')).toEqual({ ok: true, path: 'sketches/s/a.webp' });
  });

  it('accepts png, jpg, jpeg and webp, all lower or all upper case (what the image glob lists)', () => {
    for (const name of ['a.png', 'a.jpg', 'a.jpeg', 'a.webp', 'a.PNG', 'a.JPG']) {
      expect(resolveImagePath(folder, `./${name}`).ok).toBe(true);
    }
  });

  it('rejects other extensions, and mixed case the glob would miss', () => {
    expect(resolveImagePath(folder, './a.gif')).toEqual({ ok: false, error: expect.stringContaining('png, jpg, jpeg, webp') });
    expect(resolveImagePath(folder, './a')).toMatchObject({ ok: false });
    expect(resolveImagePath(folder, './a.Jpg')).toMatchObject({ ok: false });
  });

  it('rejects paths that leave the Sketch folder', () => {
    expect(resolveImagePath(folder, '../other/a.png')).toEqual({ ok: false, error: expect.stringContaining('Sketch 폴더 밖') });
    expect(resolveImagePath(folder, './x/../../a.png')).toMatchObject({ ok: false });
  });
});
