import { execFile } from 'node:child_process';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { normalizePath, type Plugin, type ViteDevServer } from 'vite';
import { captureFileName, numberedFileName } from '../src/capture/file-name.ts';
import { type GitState, embedMetadata, withGit } from '../src/capture/metadata.ts';
import { CAPTURE_ENDPOINT, decodeCaptureRequest } from '../src/capture/request.ts';

/** Where Captures and Recordings are saved, one folder per Sketch; ignored by Vite's watcher and git. */
export const CAPTURES_DIR = 'captures';
/** A 3840×3840 PNG of noise is about 60 MB; anything far past that is a mistake. */
const MAX_BODY_BYTES = 256 * 1024 * 1024;

/** Where a store function saves, and how it reads the repo state. */
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
 * Whether `sketch` names a folder right under `sketches/`, so `captures/<sketch>/` can't point
 * anywhere else. (The decoders have already checked `isSafeSketchName`.)
 */
export async function sketchExists(root: string, sketch: string): Promise<boolean> {
  const sketches = path.resolve(root, 'sketches');
  const sketchDir = path.resolve(sketches, sketch);
  return path.dirname(sketchDir) === sketches && isDirectory(sketchDir);
}

/**
 * Writes `files` into `dir` under their names, or under the first `-2`, `-3` … numbering at
 * which none of them exists yet, and returns the names written. Each file is created with `wx`,
 * so two saves in the same second never overwrite anything; a partly written set is removed
 * before the next numbering is tried.
 */
export async function writeNumbered(dir: string, files: readonly { name: string; data: Uint8Array | string }[]): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  for (let n = 1; ; n++) {
    const written: string[] = [];
    try {
      for (const { name, data } of files) {
        const file = numberedFileName(name, n);
        await writeFile(path.join(dir, file), data, { flag: 'wx' });
        written.push(file);
      }
      return written;
    } catch (error) {
      await Promise.all(written.map((file) => unlink(path.join(dir, file)).catch(() => {})));
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}

/**
 * Saves one `POST /__capture` body as `captures/<sketch>/<sketch>_<time>_<W>x<H>.png` (`-2` …
 * on a clash), with the metadata and the git state embedded. The Sketch must exist under
 * `sketches/`, so the name can't point anywhere else.
 */
export async function storeCapture(body: Uint8Array, { root, git }: StoreOptions): Promise<StoreResult> {
  const decoded = decodeCaptureRequest(body);
  if (!decoded.ok) return { status: 400, body: { error: decoded.error } };
  const { meta, png } = decoded;
  if (!(await sketchExists(root, meta.sketch))) return { status: 400, body: { error: `Sketch가 없습니다: ${meta.sketch}` } };

  const gitState = await git();
  const data = embedMetadata(png, gitState ? withGit(meta, gitState) : meta);
  const name = captureFileName(meta.sketch, meta.capturedAt, meta.size);
  const [file] = await writeNumbered(path.join(root, CAPTURES_DIR, meta.sketch), [{ name, data }]);
  return { status: 200, body: { path: `${CAPTURES_DIR}/${meta.sketch}/${file}` } };
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

class BodyTooLarge extends Error {
  constructor() {
    super('요청 본문이 너무 큽니다.');
  }
}

/**
 * The request body, up to `maxBytes`. A bigger one is read to the end but thrown away before
 * `BodyTooLarge` is thrown, so the connection stays usable for the 413 reply (the browser then
 * downloads instead). With a `Content-Length`, the body is copied straight into one buffer rather
 * than collected and concatenated, so a large Recording isn't held twice.
 */
async function readBody(req: IncomingMessage, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers['content-length']);
  const known = Number.isInteger(declared) && declared >= 0 && declared <= maxBytes;
  const buffer = known ? new Uint8Array(declared) : null;
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of req as AsyncIterable<Buffer>) {
    const offset = size;
    size += part.length;
    if (size > maxBytes || (buffer && size > buffer.length)) continue; // drain
    if (buffer) buffer.set(part, offset);
    else parts.push(part);
  }
  if (size > maxBytes) throw new BodyTooLarge();
  if (buffer && size !== buffer.length) throw new Error('요청 본문 길이가 Content-Length와 다릅니다.');
  return buffer ?? new Uint8Array(Buffer.concat(parts));
}

/**
 * Serves `POST <endpoint>` on the dev server: reads the body (up to `maxBytes`), hands it to
 * `store` and replies with its JSON. Any other method gets a 405, which the browser takes as
 * "no endpoint here".
 */
export function serveSaveEndpoint(
  server: ViteDevServer,
  endpoint: string,
  maxBytes: number,
  store: (body: Uint8Array, options: StoreOptions) => Promise<StoreResult>,
): void {
  const { root } = server.config;
  const tag = endpoint.replace(/^\/__/, '');
  server.middlewares.use(endpoint, (req, res) => {
    const reply = ({ status, body }: StoreResult) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return reply({ status: 405, body: { error: 'POST만 받습니다.' } });
    readBody(req, maxBytes)
      .then((body) => store(body, { root, git: () => gitState(root) }))
      .then(reply, (error: unknown) => {
        server.config.logger.error(`[${tag}] ${messageOf(error)}`);
        reply({ status: error instanceof BodyTooLarge ? 413 : 500, body: { error: messageOf(error) } });
      });
  });
}

/**
 * The dev server side of Capture: `POST /__capture` writes into `captures/`, which is kept out
 * of Vite's watcher so saving never reloads the page (and is gitignored). Recordings are saved
 * there too (`plugins/recording.ts`).
 */
export function capturePlugin(): Plugin {
  return {
    name: 'shader-playground:capture',
    config(config) {
      const base = normalizePath(path.resolve(config.root ?? process.cwd()));
      return { server: { watch: { ignored: [`${base}/${CAPTURES_DIR}/**`] } } };
    },
    configureServer(server) {
      serveSaveEndpoint(server, CAPTURE_ENDPOINT, MAX_BODY_BYTES, storeCapture);
    },
  };
}
