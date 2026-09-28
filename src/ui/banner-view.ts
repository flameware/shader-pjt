import type { Diagnostic } from '../diagnostics/diagnostic';

export interface BannerEntry {
  /** `file:line`, or just `file` when the line is unknown. */
  location?: string;
  message: string;
  code?: string;
}

export interface BannerView {
  errors: BannerEntry[];
  warnings: BannerEntry[];
  /** What is on screen while there are errors; `null` when there are none. */
  status: string | null;
}

function entry({ file, line, message, code }: Diagnostic): BannerEntry {
  const location = file === undefined ? undefined : line === undefined ? file : `${file}:${line}`;
  return { ...(location ? { location } : {}), message, ...(code ? { code } : {}) };
}

/**
 * What the banner shows for the current diagnostics. `running` says whether a successfully
 * compiled version is on screen (false only when nothing has compiled since the page loaded).
 */
export function bannerView(diagnostics: readonly Diagnostic[], running: boolean): BannerView | null {
  if (diagnostics.length === 0) return null;
  const errors = diagnostics.filter((d) => d.severity === 'error').map(entry);
  const warnings = diagnostics.filter((d) => d.severity === 'warning').map(entry);
  const status =
    errors.length === 0
      ? null
      : `${running ? '마지막 성공 버전 실행 중' : '실행 중인 버전 없음'} · 고쳐서 저장하면 다시 컴파일`;
  return { errors, warnings, status };
}
