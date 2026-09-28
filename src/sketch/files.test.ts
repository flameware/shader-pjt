import { describe, expect, it } from 'vitest';
import { sketchPassFiles } from './files';

describe('sketchPassFiles', () => {
  it('makes each top-level .frag of the Sketch a Pass named after the file', () => {
    const paths = ['/sketches/s/main.frag', '/sketches/s/blur_2.frag', '/sketches/other/main.frag', '/sketches/other/x.frag'];
    expect(sketchPassFiles('s', paths)).toEqual({
      passFiles: { blur_2: 'sketches/s/blur_2.frag', main: 'sketches/s/main.frag' },
      diagnostics: [],
    });
  });

  it('ignores .frag files in subfolders, with a warning', () => {
    const { passFiles, diagnostics } = sketchPassFiles('s', ['/sketches/s/main.frag', '/sketches/s/old/main.frag']);
    expect(passFiles).toEqual({ main: 'sketches/s/main.frag' });
    expect(diagnostics).toEqual([
      { severity: 'warning', file: 'sketches/s/old/main.frag', message: expect.stringContaining('하위 폴더') },
    ]);
  });

  it('ignores a top-level .frag whose name is not a valid Pass name, with a warning', () => {
    const { passFiles, diagnostics } = sketchPassFiles('s', ['/sketches/s/main.frag', '/sketches/s/Blur-A.frag', '/sketches/s/2x.frag']);
    expect(passFiles).toEqual({ main: 'sketches/s/main.frag' });
    expect(diagnostics.map((d) => [d.severity, d.file])).toEqual([
      ['warning', 'sketches/s/2x.frag'],
      ['warning', 'sketches/s/Blur-A.frag'],
    ]);
    expect(diagnostics[0]?.message).toContain('[a-z][a-z0-9_]*');
  });
});
