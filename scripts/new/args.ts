import { normalizeSlug } from './name.ts';

/** What a new Sketch starts from (#12 decisions 6, 7): a Template, or a copy of a Sketch (`null` = the latest). */
export type Start = { template: string } | { from: string | null };

export interface NewRequest {
  /** Normalized; `''` for a date-only name. */
  slug: string;
  start: Start;
  /** Open `main.frag` in the editor afterwards. */
  open: boolean;
}

/** A command line that can't be run; the message is shown with the usage. */
export class UsageError extends Error {}

export const USAGE = `사용법: npm run new -- [slug...] [-t <Template> | --from [Sketch]] [--no-open]

  npm run new                          오늘 날짜의 새 Sketch (default Template)
  npm run new -- waves                 YYYY-MM-DD-waves
  npm run new -- -t feedback trails    feedback Template으로 시작
  npm run new -- --from                가장 최근 Sketch의 소스 파일을 복사
  npm run new -- --from 2026-09-27-waves waves
  npm run new -- waves --from          가장 최근 Sketch를 복사하고 slug는 waves
  npm run new -- --no-open waves       에디터를 열지 않음

  -t, --template <이름>   templates/<이름>/ 에서 시작 (기본: default)
  --from [Sketch]         기존 Sketch의 *.frag, *.glsl, sketch.ts만 복사 (이름을 생략하면 가장 최근 Sketch)
  --no-open               만든 뒤 main.frag를 에디터로 열지 않음
  -h, --help              이 도움말`;

/** Parses the arguments after `npm run new --`. */
export function parseNewArgs(argv: readonly string[]): NewRequest | { help: true } {
  const words: string[] = [];
  let template: string | undefined;
  let from: string | null | undefined;
  let open = true;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [flag, inline] = arg.startsWith('--') && arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const next = argv[i + 1];
    const nextIsValue = next !== undefined && !next.startsWith('-');

    if (flag === '--') {
      words.push(...argv.slice(i + 1));
      break;
    } else if (flag === '-h' || flag === '--help') {
      return { help: true };
    } else if (flag === '-t' || flag === '--template') {
      if (inline !== undefined) template = inline;
      else if (nextIsValue) template = argv[++i]!;
      else throw new UsageError(`${flag}에 Template 이름이 필요합니다 (예: -t feedback)`);
      if (template === '') throw new UsageError(`${flag}에 Template 이름이 필요합니다 (예: -t feedback)`);
    } else if (flag === '--from') {
      if (inline !== undefined) from = inline === '' ? null : inline;
      else from = nextIsValue ? argv[++i]! : null;
    } else if (flag === '--no-open') {
      open = false;
    } else if (flag.startsWith('-') && flag !== '-') {
      throw new UsageError(`알 수 없는 옵션: ${arg}`);
    } else {
      words.push(arg);
    }
  }

  if (template !== undefined && from !== undefined) {
    throw new UsageError('-t(--template)와 --from은 같이 쓸 수 없습니다. 둘 중 하나만 주세요');
  }

  let slug = '';
  if (words.length > 0) {
    const raw = words.join(' ');
    slug = normalizeSlug(raw);
    if (slug === '') {
      throw new UsageError(`'${raw}'에서 slug를 만들 수 없습니다. slug에는 영문 소문자, 숫자, -만 남습니다 (예: soft-waves)`);
    }
  }

  const start: Start = from !== undefined ? { from } : { template: template ?? 'default' };
  return { slug, start, open };
}
