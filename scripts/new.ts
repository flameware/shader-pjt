// `npm run new -- [slug...] [-t <Template> | --from [Sketch]] [--no-open]` (#12, #21).
// Makes a new Sketch folder and opens its main.frag. Doesn't touch git or start the dev server.
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import launchEditor from 'launch-editor';
import { parseNewArgs, UsageError, USAGE } from './new/args.ts';
import { createSketch, NewSketchError } from './new/create.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

function fail(message: string, usage = false): never {
  console.error(message);
  if (usage) console.error('도움말: npm run new -- --help');
  process.exit(1);
}

let parsed: ReturnType<typeof parseNewArgs>;
try {
  parsed = parseNewArgs(process.argv.slice(2));
} catch (error) {
  if (error instanceof UsageError) fail(error.message, true);
  throw error;
}

if ('help' in parsed) {
  console.log(USAGE);
  process.exit(0);
}

let created: ReturnType<typeof createSketch>;
try {
  created = createSketch(root, parsed, new Date());
} catch (error) {
  if (error instanceof NewSketchError) {
    const named = 'from' in parsed.start && parsed.start.from !== null;
    // `--from waves` reads `waves` as the Sketch to copy, not as the slug.
    fail(named ? `${error.message}\n가장 최근 Sketch를 복사하면서 slug를 주려면 slug를 --from 앞에 쓰세요: npm run new -- waves --from` : error.message);
  }
  throw error;
}

console.log(`새 Sketch: ${relative(process.cwd(), created.dir)}/`);

if (parsed.open) {
  // Same detection as Vite's "open in editor": a running editor, or the LAUNCH_EDITOR env variable.
  launchEditor(created.mainFile, () => {
    console.error('main.frag를 에디터로 열지 못했습니다 (Sketch는 만들어졌습니다). LAUNCH_EDITOR 환경 변수로 지정하거나 (예: LAUNCH_EDITOR=code) --no-open을 쓰세요.');
  });
}
