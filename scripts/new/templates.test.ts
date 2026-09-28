import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findDeclarations } from '../../src/params/declarations.ts';
import { buildPassGraph } from '../../src/sketch/graph.ts';
import feedbackConfig from '../../templates/feedback/sketch.ts';

/** The Parameters a Template's `main.frag` declares, through the same parser the app uses. */
function parameters(template: string) {
  const file = `templates/${template}/main.frag`;
  const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  const lines = source.split('\n').map((_, i): [number, number] => [0, i + 1]);
  return findDeclarations({ source, lines, files: [file] });
}

describe('Templates', () => {
  it('default declares a speed Parameter and nothing else to warn about', () => {
    const { declarations, diagnostics } = parameters('default');
    expect(diagnostics).toEqual([]);
    expect(declarations).toMatchObject([{ name: 'speed', spec: { kind: 'float', min: 0, max: 2, default: 1 } }]);
  });

  it('feedback declares a decay Parameter', () => {
    const { declarations, diagnostics } = parameters('feedback');
    expect(diagnostics).toEqual([]);
    expect(declarations).toMatchObject([{ name: 'decay', spec: { kind: 'float', min: 0.8, max: 1, step: 0.001, default: 0.96 } }]);
  });

  it("feedback's sketch.ts feeds main its own previous frame", () => {
    const { graph, diagnostics } = buildPassGraph({
      sketchFile: 'templates/feedback/sketch.ts',
      passFiles: { main: 'templates/feedback/main.frag' },
      config: feedbackConfig,
      floatLinear: true,
    });
    expect(diagnostics).toEqual([]);
    expect(graph?.passes.main).toMatchObject({ channels: [{ pass: 'main', prev: true }], feedback: true });
  });
});
