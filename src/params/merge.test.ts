import { describe, expect, it } from 'vitest';
import type { ParamSpec } from './annotation';
import type { Declaration } from './declarations';
import { mergeDeclarations, parameterPassOrder } from './merge';

const float = (min: number, max: number, def = min): ParamSpec => ({ kind: 'float', min, max, default: def });
const decl = (name: string, spec: ParamSpec, file: string, line = 1): Declaration => ({
  name,
  type: spec.kind === 'int' ? 'int' : 'float',
  spec,
  file,
  line,
});

describe('mergeDeclarations', () => {
  it('lists Parameters in declaration order, pass by pass, with a name shared by several Passes once', () => {
    const { parameters, conflicts } = mergeDeclarations([
      { pass: 'main', declarations: [decl('speed', float(0, 2), 'main.frag', 1), decl('grain', float(0, 1), 'main.frag', 2)] },
      { pass: 'blur', declarations: [decl('radius', float(0, 8), 'blur.frag', 1), decl('speed', float(0, 2), 'blur.frag', 5)] },
    ]);
    expect(parameters.map((p) => [p.name, p.file])).toEqual([
      ['speed', 'main.frag'],
      ['grain', 'main.frag'],
      ['radius', 'blur.frag'],
    ]);
    expect(conflicts).toEqual({});
  });

  it('flags every declaration of a name whose type or annotation differs, against each Pass', () => {
    const { parameters, conflicts } = mergeDeclarations([
      { pass: 'main', declarations: [decl('speed', float(0, 2), 'main.frag', 3)] },
      { pass: 'blur', declarations: [decl('speed', float(0, 4), 'blur.frag', 7)] },
      { pass: 'ok', declarations: [decl('other', float(0, 1), 'ok.frag')] },
    ]);
    expect(parameters.map((p) => p.name)).toEqual(['other']);
    expect(conflicts).toEqual({
      main: [
        {
          severity: 'error',
          file: 'main.frag',
          line: 3,
          message: "Parameter 'speed'의 선언이 blur.frag:7과 다릅니다. 같은 이름은 타입과 어노테이션이 같아야 합니다",
        },
      ],
      blur: [
        {
          severity: 'error',
          file: 'blur.frag',
          line: 7,
          message: "Parameter 'speed'의 선언이 main.frag:3과 다릅니다. 같은 이름은 타입과 어노테이션이 같아야 합니다",
        },
      ],
    });
  });

  it('treats annotations that read the same as the same, however they are spelled', () => {
    const a = { kind: 'float', min: 0, max: 1, default: 0.5, step: 0.1 } as const;
    const b = { step: 0.1, default: 0.5, max: 1, min: 0, kind: 'float' } as const;
    expect(mergeDeclarations([{ pass: 'main', declarations: [decl('x', a, 'a')] }, { pass: 'p', declarations: [decl('x', b, 'b')] }]).conflicts).toEqual({});
  });
});

describe('parameterPassOrder', () => {
  it('puts main first, then the running Passes in execution order, then the rest by name', () => {
    expect(parameterPassOrder(['main', 'zed', 'blur', 'sim', 'alpha'], ['sim', 'blur', 'main'])).toEqual(['main', 'sim', 'blur', 'alpha', 'zed']);
  });

  it('falls back to main then names when there is no pass graph', () => {
    expect(parameterPassOrder(['b', 'main', 'a'], null)).toEqual(['main', 'a', 'b']);
  });
});
