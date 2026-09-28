import type { Diagnostic } from '../diagnostics/diagnostic';
import { isEngineUniformName } from '../engine/uniforms';
import { includeChain, type ShaderSource } from '../shader-source';
import { type ParamGlslType, type ParamSpec, parseAnnotation } from './annotation';

/** One `uniform … // @param …` line of a Pass, after include expansion. */
export interface Declaration {
  name: string;
  type: ParamGlslType;
  spec: ParamSpec;
  /** Project-relative file and 1-based line the declaration was written on. */
  file: string;
  line: number;
}

export interface DeclarationsResult {
  declarations: Declaration[];
  /** Errors block the Pass's new version (the last good one keeps running); warnings don't. */
  diagnostics: Diagnostic[];
}

/** `uniform [precision] type name; // comment` — exactly one uniform on the line. */
const SINGLE_UNIFORM = /^\s*uniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*;\s*(\/\/.*)?$/;
/** Any other `uniform …;` line: several names, arrays. Uniform blocks (`uniform B {`) don't match. */
const ANY_UNIFORM = /^\s*uniform\s+(?:(?:lowp|mediump|highp)\s+)?\w+\s+([^;{]*);/;
/** A `//` comment that starts with `@param`; group 1 is the annotation. */
const PARAM_COMMENT = /^\/\/\s*@param\b(.*)$/;

const ONLY_ON_UNIFORMS = '@param은 uniform 선언 한 줄(`uniform float speed; // @param 0..2 = 1`)에만 붙일 수 있습니다';
const IN_LIBRARY = 'Library 파일에는 @param을 둘 수 없습니다. Sketch 파일로 옮기세요';
const engineName = (name: string) => `'${name}'은 엔진 uniform 이름(i + 대문자)과 겹칩니다. 다른 이름을 쓰세요`;
const noParam = (name: string) => `uniform '${name}'에 @param이 없어 GUI에 나오지 않고 값이 항상 0입니다`;

/** The annotation text when the line's first `//` comment starts with `@param`. */
function annotationOf(line: string): string | undefined {
  const comment = line.indexOf('//');
  if (comment < 0) return undefined;
  return PARAM_COMMENT.exec(line.slice(comment))?.[1];
}

/**
 * Reads the Parameter declarations of one Pass from its include-expanded source (#6, #19).
 *
 * Text-only, like `#include` (#7): `/* *\/` comments and `#if` are not tracked. `@param` is
 * allowed in the Sketch's own files (so a `common.glsl` can declare shared Parameters) but is
 * an error in Library files (`lib/`, lygia). A Sketch uniform without `@param` is a warning;
 * uniforms in Library files are not checked, because lygia declares some behind `#ifdef`s.
 */
export function findDeclarations(shader: ShaderSource): DeclarationsResult {
  const passFile = shader.files[0] ?? '';
  const sketchDir = passFile.slice(0, passFile.lastIndexOf('/') + 1);
  const declarations: Declaration[] = [];
  const diagnostics: Diagnostic[] = [];

  shader.source.split('\n').forEach((text, index) => {
    const at = shader.lines[index];
    const fileIndex = at?.[0] ?? 0;
    const file = shader.files[fileIndex] ?? passFile;
    const inSketch = file.startsWith(sketchDir);
    const annotation = annotationOf(text);
    const single = SINGLE_UNIFORM.exec(text);
    const names = single ? [single[2]!] : (ANY_UNIFORM.exec(text)?.[1]?.split(',').map((n) => n.replace(/\[.*$/, '').trim()) ?? []);
    if (annotation === undefined && names.length === 0) return;

    const report = (severity: Diagnostic['severity'], message: string) => {
      const chain = includeChain(shader, fileIndex);
      diagnostics.push({
        severity,
        file,
        ...(at && { line: at[1] }),
        message,
        sourceLine: text.trim(),
        ...(chain.length > 0 && { includeChain: chain }),
      });
    };

    if (annotation !== undefined && !inSketch) return report('error', IN_LIBRARY);
    // Only the Sketch's own files: a Library uniform isn't the user's to rename.
    const reserved = inSketch ? names.filter(isEngineUniformName) : [];
    for (const name of reserved) report('error', engineName(name));
    if (reserved.length > 0) return;
    if (annotation === undefined) {
      if (inSketch) for (const name of names) report('warning', noParam(name));
      return;
    }
    if (!single) return report('error', ONLY_ON_UNIFORMS);

    const [, type, name] = single as unknown as [string, string, string];
    const parsed = parseAnnotation(type, annotation);
    if ('error' in parsed) return report('error', `${name}: ${parsed.error}`);
    declarations.push({ name, type: type as ParamGlslType, spec: parsed.spec, file, line: at?.[1] ?? index + 1 });
  });

  return { declarations, diagnostics };
}
