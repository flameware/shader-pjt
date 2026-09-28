import type { CaptureKind } from '../capture/metadata';
import type { SaveOutcome } from '../capture/save';

/** The Capture toast's two lines (#9 decision 8): what happened, and where the file is. */
export interface CaptureToastView {
  title: string;
  /** `captures/<sketch>/….png`, or the downloaded file's name. */
  where: string;
}

const KIND_NAME: Record<CaptureKind, string> = { screen: '화면 Capture', output: 'Output size Capture' };

export function captureToastView(outcome: SaveOutcome, kind: CaptureKind): CaptureToastView {
  if (outcome.saved === 'dev-server') return { title: `${KIND_NAME[kind]} 저장`, where: outcome.path };
  const title = outcome.problem ? `dev server 저장 실패(${outcome.problem}) → 다운로드` : '다운로드로 저장 (dev server 없음)';
  return { title, where: outcome.fileName };
}
