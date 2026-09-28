import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pickSketch } from '../../src/sketch/pick.ts';
import type { NewRequest } from './args.ts';
import { sketchName } from './name.ts';

/** A new Sketch that can't be made as asked (unknown Template or Sketch, ...). Nothing was created. */
export class NewSketchError extends Error {}

export interface CreatedSketch {
  name: string;
  /** Absolute path of the new Sketch folder. */
  dir: string;
  /** Absolute path of its `main.frag`, the file to open. */
  mainFile: string;
}

/** The files `--from` copies (#12 decision 7): shader sources and `sketch.ts`, not Captures or notes. */
const SOURCE_FILE = /(\.frag|\.glsl|^sketch\.ts)$/;

/** Folders of `dir` that hold a top-level `main.frag` (a Sketch, or a Template), sorted by name. */
function foldersWithMain(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'main.frag')))
    .map((entry) => entry.name)
    .sort();
}

/** Copies the `--from` source files of `from` into `to`, keeping subfolders (a Sketch may include `shapes/x.glsl`). */
function copySources(from: string, to: string): void {
  for (const entry of readdirSync(from, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !SOURCE_FILE.test(entry.name)) continue;
    const file = relative(from, join(entry.parentPath, entry.name));
    mkdirSync(dirname(join(to, file)), { recursive: true });
    copyFileSync(join(from, file), join(to, file));
  }
}

/** The folder a new Sketch is copied from, checked before anything is created. */
function sourceFolder(root: string, start: NewRequest['start']): { dir: string; sourcesOnly: boolean } {
  if ('template' in start) {
    const templates = foldersWithMain(join(root, 'templates'));
    if (!templates.includes(start.template)) {
      throw new NewSketchError(`Template '${start.template}'이 없습니다. 쓸 수 있는 Template: ${templates.join(', ') || '(없음)'}`);
    }
    return { dir: join(root, 'templates', start.template), sourcesOnly: false };
  }

  const sketches = foldersWithMain(join(root, 'sketches'));
  const name = start.from ?? pickSketch(sketches, null);
  if (name === null) throw new NewSketchError('복사할 Sketch가 없습니다 (sketches/가 비어 있습니다)');
  if (!sketches.includes(name)) {
    const recent = sketches.slice(-5).join(', ');
    throw new NewSketchError(
      `Sketch '${name}'이 없습니다. 최근 Sketch: ${recent}\n` +
        '가장 최근 Sketch를 복사하면서 slug를 주려면 slug를 --from 앞에 쓰세요: npm run new -- waves --from',
    );
  }
  return { dir: join(root, 'sketches', name), sourcesOnly: true };
}

/**
 * Makes a new Sketch under `root/sketches/` (#12): named `YYYY-MM-DD[-slug]` from `now` (local
 * time), started from a Template (the whole folder is copied) or from an existing Sketch (only
 * its source files). The new Sketch has no link to where it came from.
 */
export function createSketch(root: string, request: Pick<NewRequest, 'slug' | 'start'>, now: Date): CreatedSketch {
  const source = sourceFolder(root, request.start);
  const sketches = join(root, 'sketches');
  const name = sketchName(now, request.slug, (candidate) => existsSync(join(sketches, candidate)));
  const dir = join(sketches, name);

  mkdirSync(sketches, { recursive: true });
  mkdirSync(dir); // not recursive: fails rather than writing into a folder that appeared meanwhile
  if (source.sourcesOnly) copySources(source.dir, dir);
  else cpSync(source.dir, dir, { recursive: true });

  return { name, dir, mainFile: join(dir, 'main.frag') };
}
