import { describe, expect, it } from 'vitest';
import type { Diagnostic } from '../diagnostics/diagnostic';
import { bannerView } from './banner-view';

const colr: Diagnostic = {
  severity: 'error',
  file: 'sketches/2026-09-28-hello/main.frag',
  line: 7,
  message: "'colr' : undeclared identifier",
  sourceLine: 'vec3 col = colr * 0.5;',
};

describe('bannerView', () => {
  it('shows nothing when there is nothing to report', () => {
    expect(bannerView([], true)).toBeNull();
  });

  it('shows each error at file:line, and says the last good version keeps running', () => {
    expect(bannerView([colr], true)).toEqual({
      errors: [
        {
          location: 'sketches/2026-09-28-hello/main.frag:7',
          message: "'colr' : undeclared identifier",
          sourceLine: 'vec3 col = colr * 0.5;',
        },
      ],
      warnings: [],
      status: '마지막 성공 버전 실행 중 · 고쳐서 저장하면 다시 컴파일',
    });
  });

  it('says nothing is running when no version has ever compiled', () => {
    expect(bannerView([colr], false)?.status).toBe('실행 중인 버전 없음 · 고쳐서 저장하면 다시 컴파일');
  });

  it('keeps warnings apart from errors, and has no status line when there are only warnings', () => {
    const view = bannerView(
      [
        { severity: 'warning', message: 'Pass "blur" is never referenced' },
        { severity: 'warning', file: 'sketches/x/main.frag', message: 'uniform without @param' },
      ],
      true,
    );
    expect(view).toEqual({
      errors: [],
      warnings: [
        { message: 'Pass "blur" is never referenced' },
        { location: 'sketches/x/main.frag', message: 'uniform without @param' },
      ],
      status: null,
    });
  });

  it('keeps every error in order', () => {
    const view = bannerView([colr, { ...colr, line: 9, message: 'b' }], true);
    expect(view?.errors.map((e) => e.location)).toEqual([
      'sketches/2026-09-28-hello/main.frag:7',
      'sketches/2026-09-28-hello/main.frag:9',
    ]);
  });
});
