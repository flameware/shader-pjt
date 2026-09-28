import { describe, expect, it } from 'vitest';
import { captureToastView } from './capture-view';

describe('captureToastView', () => {
  it('shows the path the dev server wrote', () => {
    expect(captureToastView({ saved: 'dev-server', path: 'captures/flow/flow_20260928-213045_800x600.png' }, 'screen')).toEqual({
      title: '화면 Capture 저장',
      where: 'captures/flow/flow_20260928-213045_800x600.png',
    });
  });

  it('names the kind of Capture', () => {
    expect(captureToastView({ saved: 'dev-server', path: 'captures/flow/flow_20260928-213045_2160x2700.png' }, 'output').title).toBe(
      'Output size Capture 저장',
    );
  });

  it('says a download stood in, and why when the dev server failed', () => {
    expect(captureToastView({ saved: 'download', fileName: 'f.png' }, 'screen')).toEqual({ title: '다운로드로 저장 (dev server 없음)', where: 'f.png' });
    expect(captureToastView({ saved: 'download', fileName: 'f.png', problem: 'disk full' }, 'output')).toEqual({
      title: 'dev server 저장 실패(disk full) → 다운로드',
      where: 'f.png',
    });
  });
});
