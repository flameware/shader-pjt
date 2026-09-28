import { describe, expect, it } from 'vitest';
import { createDiagnosticsBoard } from './board';
import type { Diagnostic } from './diagnostic';

const error = (message: string): Diagnostic => ({ severity: 'error', message });
const warning = (message: string): Diagnostic => ({ severity: 'warning', message });

describe('createDiagnosticsBoard', () => {
  it('starts empty', () => {
    expect(createDiagnosticsBoard().all()).toEqual([]);
  });

  it('keeps what each source reported and replaces only that source on the next report', () => {
    const board = createDiagnosticsBoard();
    board.report('compile:main.frag', [error('a'), error('b')]);
    board.report('graph', [warning('unused pass')]);
    board.report('compile:main.frag', [error('c')]);
    expect(board.all()).toEqual([error('c'), warning('unused pass')]);
  });

  it('forgets a source once it reports nothing, so fixing one problem leaves the others', () => {
    const board = createDiagnosticsBoard();
    board.report('compile:main.frag', [error('a')]);
    board.report('include:main.frag', [error('missing file')]);
    board.report('compile:main.frag', []);
    expect(board.all()).toEqual([error('missing file')]);
  });

  it('tells subscribers after every change', () => {
    const board = createDiagnosticsBoard();
    const seen: Diagnostic[][] = [];
    board.subscribe((all) => seen.push(all));
    board.report('compile:main.frag', [error('a')]);
    board.report('compile:main.frag', []);
    expect(seen).toEqual([[error('a')], []]);
  });
});
