import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizePath, type Plugin } from 'vite';
import { captureFileName, numberedFileName } from '../src/capture/file-name.ts';
import { type GitState, embedMetadata, withGit } from '../src/capture/metadata.ts';
import { CAPTURE_ENDPOINT, decodeCaptureRequest } from '../src/capture/request.ts';

const CAPTURES_DIR = 'captures';
/** A 3840×3840 PNG of noise is about 60 MB; anything far past that is a mistake. */
const MAX_BODY_BYTES = 256 * 1024 * 1024;

/** Where `storeCapture` saves, and how it reads the repo state. */
export interface StoreOptions {
  /** The repo root: `sketches/` and `captures/` are under it. */
  root: string;
  git(): Promise<GitState | undefined>;
}

/** The HTTP status and JSON reply for the browser. */
export interface StoreResult {
  status: number;
  body: { path: string } | { error: string };
}

const isDirectory = (dir: string) => stat(dir).then((s) => s.isDirectory(), () => false);

/**
 * Saves one `POST /__capture` body as `captures/<sketch>/<sketch>_<time>_<W>x<H>.png` (`-2` …
 * on a clash), with the metadata and the git state embedded. The Sketch must exist under
 * `sketches/`, so the name can't point anywhere else.
 */
export async function storeCapture(body: Uint8Array, { root, git }: StoreOptions): Promise<StoreResult> {
  const decoded = decodeCaptureRequest(body);
  if (!decoded.ok) return { status: 400, body: { error: decoded.error } };
  const { meta, png } = decoded;
  const sketches = path.resolve(root, 'sketches');
  const sketchDir = path.resolve(sketches, meta.sketch);
  if (path.dirname(sketchDir) !== sketches || !(await isDirectory(sketchDir))) {
    return { status: 400, body: { error: `Sketch가 없습니다: ${meta.sketch}` } };
  }

  const gitState = await git();
  const bytes = embedMetadata(png, gitState ? withGit(meta, gitState) : meta);
  const dir = path.join(root, CAPTURES_DIR, meta.sketch);
  await mkdir(dir, { recursive: true });
  const name = captureFileName(meta.sketch, meta.capturedAt, meta.size);
  for (let n = 1; ; n++) {
    const file = numberedFileName(name, n);
    try {
      // `wx` fails when the file exists, so two Captures in the same second never overwrite.
      await writeFile(path.join(dir, file), bytes, { flag: 'wx' });
      return { status: 200, body: { path: `${CAPTURES_DIR}/${meta.sketch}/${file}` } };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

const execFileAsync = promisify(execFile);
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The short HEAD commit and whether the work tree has changes; `undefined` outside a git repo. */
async function gitState(root: string): Promise<GitState | undefined> {
  try {
    const [head, status] = await Promise.all([
      execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }),
      execFileAsync('git', ['status', '--porcelain'], { cwd: root }),
    ]);
    return { commit: head.stdout.trim(), dirty: status.stdout.trim() !== '' };
  } catch {
    return undefined;
  }
}

async function readBody(req: IncomingMessage): Promise<Uint8Array> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of req as AsyncIterable<Buffer>) {
    size += part.length;
    if (size > MAX_BODY_BYTES) throw new Error('Capture가 너무 큽니다.');
    parts.push(part);
  }
  return new Uint8Array(Buffer.concat(parts));
}

/**
 * The dev server side of Capture: `POST /__capture` writes into `captures/`, which is kept out
 * of Vite's watcher so saving never reloads the page (and is gitignored).
 */
export function capturePlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'shader-playground:capture',
    config(config) {
      const base = normalizePath(path.resolve(config.root ?? process.cwd()));
      return { server: { watch: { ignored: [`${base}/${CAPTURES_DIR}/**`] } } };
    },
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.middlewares.use(CAPTURE_ENDPOINT, (req, res) => {
        const reply = ({ status, body }: StoreResult) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return reply({ status: 405, body: { error: 'POST만 받습니다.' } });
        readBody(req)
          .then((body) => storeCapture(body, { root, git: () => gitState(root) }))
          .then(reply, (error: unknown) => {
            server.config.logger.error(`[capture] ${messageOf(error)}`);
            reply({ status: 500, body: { error: messageOf(error) } });
          });
      });
    },
  };
}
