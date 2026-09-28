import { captureFileName } from './file-name';
import { type CaptureMetadata, embedMetadata } from './metadata';
import { CAPTURE_ENDPOINT, encodeCaptureRequest } from './request';

export type SaveOutcome =
  | { saved: 'dev-server'; path: string }
  /** `problem`: why the dev server couldn't save it, when it has an endpoint and it failed. */
  | { saved: 'download'; fileName: string; problem?: string };

/** How a Capture leaves the page; the browser's `fetch` and a download link by default. */
export interface SaveTransport {
  /** Posts to `/__capture`; rejects when the request can't be made at all. */
  post(body: Uint8Array<ArrayBuffer>): Promise<{ status: number; json: unknown }>;
  download(bytes: Uint8Array, fileName: string): void;
}

const hasPath = (json: unknown): json is { path: string } =>
  typeof json === 'object' && json !== null && typeof (json as { path?: unknown }).path === 'string';
const errorOf = (json: unknown): string | undefined =>
  typeof json === 'object' && json !== null && typeof (json as { error?: unknown }).error === 'string'
    ? (json as { error: string }).error
    : undefined;

/**
 * Saves a Capture PNG (no metadata chunks yet) described by `meta` (#8 decisions 10–12). The dev
 * server writes it to `captures/<sketch>/` and adds `git`. Without that endpoint (a static
 * build) it is downloaded under the same name, with the metadata but without `git`; it is also
 * downloaded when the dev server fails, so the frame isn't lost.
 */
export async function saveCapture(meta: CaptureMetadata, png: Uint8Array, transport: SaveTransport = browserTransport): Promise<SaveOutcome> {
  let problem: string | undefined;
  try {
    const { status, json } = await transport.post(encodeCaptureRequest(meta, png));
    if (status === 200 && hasPath(json)) return { saved: 'dev-server', path: json.path };
    // 404/405 (or a 200 page that isn't ours) means there is no endpoint here.
    if (status !== 404 && status !== 405 && status !== 200) problem = errorOf(json) ?? `HTTP ${status}`;
  } catch {
    // no server to talk to
  }
  const fileName = captureFileName(meta.sketch, meta.capturedAt, meta.size);
  transport.download(embedMetadata(png, meta), fileName);
  return problem === undefined ? { saved: 'download', fileName } : { saved: 'download', fileName, problem };
}

/** `fetch` to the dev server, and a download through a temporary link. */
export const browserTransport: SaveTransport = {
  async post(body) {
    const response = await fetch(CAPTURE_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
    const json: unknown = await response.json().catch(() => null);
    return { status: response.status, json };
  },
  download(bytes, fileName) {
    const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};
