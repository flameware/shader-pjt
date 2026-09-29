import { captureFileName } from './file-name';
import { type CaptureMetadata, embedMetadata } from './metadata';
import { CAPTURE_ENDPOINT, encodeCaptureRequest } from './request';

export type SaveOutcome =
  | { saved: 'dev-server'; path: string }
  /** `problem`: why the dev server couldn't save it, when it has an endpoint and it failed. */
  | { saved: 'download'; fileName: string; problem?: string };

/** How a Capture or Recording leaves the page; the browser's `fetch` and a download link by default. */
export interface SaveTransport {
  /** Posts to the dev server's endpoint; rejects when the request can't be made at all. */
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
 * Posts `body` to the dev server, which writes the file under `captures/`. Without that endpoint
 * (a static build) `fallback` is downloaded instead; it is also downloaded when the dev server
 * fails, so nothing is lost.
 */
export async function saveOrDownload(
  body: Uint8Array<ArrayBuffer>,
  fallback: { bytes: Uint8Array; fileName: string },
  transport: SaveTransport,
): Promise<SaveOutcome> {
  let problem: string | undefined;
  try {
    const { status, json } = await transport.post(body);
    if (status === 200 && hasPath(json)) return { saved: 'dev-server', path: json.path };
    // 404/405 (or a 200 page that isn't ours) means there is no endpoint here.
    if (status !== 404 && status !== 405 && status !== 200) problem = errorOf(json) ?? `HTTP ${status}`;
  } catch {
    // no server to talk to
  }
  const { bytes, fileName } = fallback;
  transport.download(bytes, fileName);
  return problem === undefined ? { saved: 'download', fileName } : { saved: 'download', fileName, problem };
}

/**
 * Saves a Capture PNG (no metadata chunks yet) described by `meta` (#8 decisions 10–12). The dev
 * server writes it to `captures/<sketch>/` and adds `git`. Otherwise it is downloaded under the
 * same name, with the metadata but without `git`.
 */
export function saveCapture(meta: CaptureMetadata, png: Uint8Array, transport: SaveTransport = browserTransport): Promise<SaveOutcome> {
  const fileName = captureFileName(meta.sketch, meta.capturedAt, meta.size);
  return saveOrDownload(encodeCaptureRequest(meta, png), { bytes: embedMetadata(png, meta), fileName }, transport);
}

/** `fetch` to the dev server's `endpoint`, and a download of `type` through a temporary link. */
export function fetchTransport(endpoint: string, type: string): SaveTransport {
  return {
    async post(body) {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
      const json: unknown = await response.json().catch(() => null);
      return { status: response.status, json };
    },
    download: (bytes, fileName) => downloadFile(bytes, fileName, type),
  };
}

/** Capture's transport: `/__capture`, PNG downloads. */
export const browserTransport: SaveTransport = fetchTransport(CAPTURE_ENDPOINT, 'image/png');

/** Downloads `bytes` as `fileName` through a temporary link. */
export function downloadFile(bytes: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
