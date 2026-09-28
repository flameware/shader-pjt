import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { expandPass, type IncludeRoots } from './include';

const project = fileURLToPath(new URL('./fixtures/include', import.meta.url));
const roots: IncludeRoots = { project, lib: join(project, 'lib'), lygia: join(project, 'fake-lygia') };
const PASS = 'sketches/a/main.frag';

function expand(code: string, r: IncludeRoots = roots) {
  return expandPass(join(project, PASS), code, r);
}

/** `[file:line, text]` for every line of the expanded source — reads like the line table it checks. */
function table(code: string) {
  const { shader } = expand(code);
  const text = shader.source.split('\n');
  return shader.lines.map(([file, line], i) => [`${shader.files[file]}:${line}`, text[i]]);
}

describe('expandPass', () => {
  it('leaves a Pass without includes as it is, one line per line', () => {
    const { shader } = expand('a\nb\n');
    expect(shader.source).toBe('a\nb');
    expect(shader.lines).toEqual([
      [0, 1],
      [0, 2],
    ]);
    expect(shader.files).toEqual([PASS]);
    expect(shader.resolveErrors).toBeUndefined();
  });

  it('expands a lib/ include in place and maps each line back to its own file and line', () => {
    expect(table('// top\n#include "lib/math/const.glsl"\nvoid mainImage() {}\n')).toEqual([
      [`${PASS}:1`, '// top'],
      ['lib/math/const.glsl:1', '#ifndef PI'],
      ['lib/math/const.glsl:2', '#define PI 3.14159265'],
      ['lib/math/const.glsl:3', '#endif'],
      [`${PASS}:3`, 'void mainImage() {}'],
    ]);
  });

  it('resolves other paths relative to the including file, inside the Sketch folder', () => {
    expect(table('#include "sub/helper.glsl"\n')).toEqual([
      ['sketches/a/common.glsl:1', '// a common'],
      ['sketches/a/common.glsl:2', 'float common1() { return 1.0; }'],
      ['sketches/a/sub/helper.glsl:2', 'float helper() { return common1(); }'],
    ]);
  });

  it('maps lygia/ to the lygia package, where includes are always relative and prefixes do not apply', () => {
    expect(table('#include "lygia/generative/fbm.glsl"\n#include "lygia/bundle.glsl"\n')).toEqual([
      ['fake-lygia/math/mod.glsl:1', 'float mod289(float x) { return x - floor(x / 289.0) * 289.0; }'],
      ['fake-lygia/generative/fbm.glsl:2', 'float fbm(float x) { return mod289(x); }'],
      ['fake-lygia/lib/inner.glsl:1', 'float lygiaInner() { return 3.0; }'],
    ]);
  });

  it('expands each file once per Pass: a second include of it, however spelled, expands to nothing', () => {
    const { shader } = expand('#include "common.glsl"\n#include "sub/../common.glsl"\n#include "sub/helper.glsl"\nx\n');
    expect(shader.files).toEqual([PASS, 'sketches/a/common.glsl', 'sketches/a/sub/helper.glsl']);
    expect(shader.source).toBe('// a common\nfloat common1() { return 1.0; }\nfloat helper() { return common1(); }\nx');
  });

  it('lets lib/ files include lib/ by prefix or relatively, still once', () => {
    const { shader } = expand('#include "lib/noise/value.glsl"\n');
    expect(shader.files).toEqual([PASS, 'lib/noise/value.glsl', 'lib/math/hash.glsl', 'lib/math/const.glsl']);
    expect(shader.source.match(/#define PI/g)).toHaveLength(1);
    expect(shader.resolveErrors).toBeUndefined();
  });

  it('records where each file was included, so every file has one include chain', () => {
    const { shader } = expand('// x\n#include "lib/noise/value.glsl"\n');
    expect(shader.includedFrom).toEqual([null, [0, 2], [1, 1], [2, 1]]);
  });

  it('reads include lines as text: // comments are skipped, #if branches are expanded, spacing and trailing comments are fine', () => {
    const { shader } = expand('// #include "missing.glsl"\n#if 0\n  #  include "common.glsl" // shared\n#endif\n');
    expect(shader.resolveErrors).toBeUndefined();
    expect(shader.source).toBe('// #include "missing.glsl"\n#if 0\n// a common\nfloat common1() { return 1.0; }\n#endif');
  });

  it('lists every file it read for watching', () => {
    const { watchFiles } = expand('#include "lib/math/hash.glsl"\n');
    expect(watchFiles.sort()).toEqual([join(roots.lib, 'math/const.glsl'), join(roots.lib, 'math/hash.glsl')]);
  });
});

describe('the repo', () => {
  it("resolves the example Sketch against the real lib/ and the installed lygia", () => {
    const repo = fileURLToPath(new URL('..', import.meta.url));
    const real = { project: repo, lib: join(repo, 'lib'), lygia: join(repo, 'node_modules/lygia') };
    const pass = join(repo, 'sketches/2026-09-28-library/main.frag');
    const { shader } = expandPass(pass, fs.readFileSync(pass, 'utf8'), real);
    expect(shader.resolveErrors).toBeUndefined();
    expect(shader.files).toEqual(
      expect.arrayContaining(['lib/noise/valueNoise.glsl', 'lib/math/hash21.glsl', 'node_modules/lygia/generative/snoise.glsl']),
    );
  });
});

describe('expandPass resolve errors', () => {
  /** The single error for a Pass, as its `file:line`, message and include chain. */
  function error(code: string, r: IncludeRoots = roots) {
    const errors = expand(code, r).shader.resolveErrors ?? [];
    expect(errors).toHaveLength(1);
    const [e] = errors;
    return { at: `${e!.file}:${e!.line}`, message: e!.message, chain: e!.includeChain };
  }

  it('reports a missing file at the include line, and asks for that path to be watched', () => {
    const result = expand('x\n#include "lib/sdf/circel.glsl"\n');
    expect(result.shader.resolveErrors).toEqual([
      {
        severity: 'error',
        file: PASS,
        line: 2,
        message: '파일 없음: "lib/sdf/circel.glsl"',
        sourceLine: '#include "lib/sdf/circel.glsl"',
      },
    ]);
    expect(result.missingFiles).toEqual([join(roots.lib, 'sdf/circel.glsl')]);
  });

  it('reports a cycle with the chain of include lines that closes it', () => {
    expect(error('#include "lib/cycle/a.glsl"\n')).toEqual({
      at: 'lib/cycle/b.glsl:2',
      message: `include 순환: ${PASS}:1 → lib/cycle/a.glsl:1 → lib/cycle/b.glsl:2 → lib/cycle/a.glsl`,
      chain: undefined,
    });
  });

  it('shows the include chain for an error inside an included file', () => {
    expect(error('\n#include "lib/bad/version.glsl"\n')).toEqual({
      at: 'lib/bad/version.glsl:1',
      message: '#version은 엔진이 붙입니다. 이 줄을 지우세요',
      chain: [`${PASS}:2`],
    });
  });

  it('rejects #version in the Pass itself', () => {
    expect(error('#version 300 es\n').at).toBe(`${PASS}:1`);
  });

  it('does not let a relative path leave the Sketch folder, even into another Sketch', () => {
    expect(error('#include "../b/common.glsl"\n').message).toBe('Sketch 폴더 밖으로 나가는 경로입니다: "../b/common.glsl"');
    expect(error('#include "sub/escape.glsl"\n')).toMatchObject({ at: 'sketches/a/sub/escape.glsl:1', chain: [`${PASS}:1`] });
  });

  it('does not let a lib/ file leave lib/', () => {
    expect(error('#include "lib/bad/escape.glsl"\n').message).toBe('lib/ 밖으로 나가는 경로입니다: "../../sketches/a/common.glsl"');
  });

  it('does not let lib/ include lygia/ (ADR-0003)', () => {
    expect(error('#include "lib/bad/usesLygia.glsl"\n')).toEqual({
      at: 'lib/bad/usesLygia.glsl:1',
      message: 'lib/ 파일은 lygia/를 include할 수 없습니다 (ADR-0003): "lygia/generative/fbm.glsl"',
      chain: [`${PASS}:1`],
    });
  });

  it('says how to install lygia when the package is missing', () => {
    const noLygia = { ...roots, lygia: join(project, 'node_modules/lygia') };
    expect(error('#include "lygia/generative/fbm.glsl"\n', noLygia).message).toBe(
      '"lygia/generative/fbm.glsl" — node_modules/lygia가 없습니다 (npm i -D -E lygia@1.4.1)',
    );
  });

  it.each([
    ['#include <lib/math/const.glsl>', '#include <...> 형식은 쓸 수 없습니다. #include "경로"를 쓰세요'],
    ['#include lib/math/const.glsl', '#include 줄을 해석할 수 없습니다. #include "경로" 형식을 쓰세요'],
    ['#include "/etc/x.glsl"', '절대경로는 쓸 수 없습니다: "/etc/x.glsl"'],
    ['#include "main.frag"', '.frag는 include할 수 없습니다: "main.frag" (공유할 코드는 .glsl로 빼세요)'],
    ['#include "lib/math/const"', '확장자 .glsl을 적어야 합니다: "lib/math/const"'],
    ['#include "lib/Math/Const.glsl"', '대소문자가 실제 파일명과 다릅니다: "lib/Math/Const.glsl" (실제 파일: lib/math/const.glsl)'],
  ])('rejects %s', (line, message) => {
    expect(error(`${line}\n`).message).toBe(message);
  });

  it('judges the root on real paths, so a symlink cannot reach outside it', () => {
    const tmp = fs.mkdtempSync(join(os.tmpdir(), 'include-'));
    try {
      fs.mkdirSync(join(tmp, 'sketches/s'), { recursive: true });
      fs.writeFileSync(join(tmp, 'outside.glsl'), 'float outside;\n');
      fs.symlinkSync(join(tmp, 'outside.glsl'), join(tmp, 'sketches/s/link.glsl'));
      const tmpRoots = { project: tmp, lib: join(tmp, 'lib'), lygia: join(tmp, 'node_modules/lygia') };
      const { shader } = expandPass(join(tmp, 'sketches/s/main.frag'), '#include "link.glsl"\n', tmpRoots);
      expect(shader.resolveErrors?.map((e) => e.message)).toEqual(['Sketch 폴더 밖을 가리키는 symlink입니다: "link.glsl"']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('keeps going after an error, so every problem in the Pass is reported at once', () => {
    const errors = expand('#include "a.glsl"\n#include "common.glsl"\n#include "b.glsl"\n').shader.resolveErrors;
    expect(errors?.map((e) => e.line)).toEqual([1, 3]);
  });
});
