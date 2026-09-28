import type { Diagnostic } from '../diagnostics/diagnostic';
import type { ParamSpec } from './annotation';
import type { Declaration } from './declarations';

export interface PassDeclarations {
  pass: string;
  declarations: readonly Declaration[];
}

export interface MergedParameters {
  /** One entry per Parameter name, in GUI order: the first declaration of each name. */
  parameters: Declaration[];
  /** Pass → errors for its declarations that disagree with another declaration of the same name. */
  conflicts: Record<string, Diagnostic[]>;
}

function sameSpec(a: ParamSpec, b: ParamSpec): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => JSON.stringify(a[key as keyof ParamSpec]) === JSON.stringify(b[key as keyof ParamSpec]));
}

const sameDeclaration = (a: Declaration, b: Declaration) => a.type === b.type && sameSpec(a.spec, b.spec);

/**
 * Joins the Passes' declarations into the Sketch's one flat Parameter list (#6 decisions 1, 5).
 * `passes` must already be in GUI order (see `parameterPassOrder`). The same name in several
 * Passes (or files) is one Parameter; when their type or annotation differ, every declaration of
 * that name is an error and the name is left out.
 */
export function mergeDeclarations(passes: readonly PassDeclarations[]): MergedParameters {
  const byName = new Map<string, { pass: string; declaration: Declaration }[]>();
  for (const { pass, declarations } of passes) {
    for (const declaration of declarations) {
      const list = byName.get(declaration.name) ?? [];
      byName.set(declaration.name, [...list, { pass, declaration }]);
    }
  }
  const parameters: Declaration[] = [];
  const conflicts: Record<string, Diagnostic[]> = {};
  for (const [name, all] of byName) {
    const first = all[0]!.declaration;
    if (all.every(({ declaration }) => sameDeclaration(declaration, first))) {
      parameters.push(first);
      continue;
    }
    for (const { pass, declaration } of all) {
      const other = all.find((o) => !sameDeclaration(o.declaration, declaration))!.declaration;
      (conflicts[pass] ??= []).push({
        severity: 'error',
        file: declaration.file,
        line: declaration.line,
        message: `Parameter '${name}'의 선언이 ${other.file}:${other.line}과 다릅니다. 같은 이름은 타입과 어노테이션이 같아야 합니다`,
      });
    }
  }
  return { parameters, conflicts };
}

/**
 * The order Passes contribute Parameters to the GUI (#6 decision 5): `main` first, then the
 * Passes that run in execution order, then Passes that don't run, by name.
 */
export function parameterPassOrder(passes: readonly string[], runOrder: readonly string[] | null): string[] {
  const running = (runOrder ?? []).filter((p) => p !== 'main' && passes.includes(p));
  const rest = passes.filter((p) => p !== 'main' && !running.includes(p)).sort();
  return [...(passes.includes('main') ? ['main'] : []), ...running, ...rest];
}
