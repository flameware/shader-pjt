import { describe, expect, it } from 'vitest';
import { type NewRequest, parseNewArgs, UsageError } from './args.ts';

const parse = (line: string) => parseNewArgs(line === '' ? [] : line.split(' '));
/** `parse` for a line that isn't a help request. */
function request(line: string): NewRequest {
  const parsed = parse(line);
  if ('help' in parsed) throw new Error('unexpected help');
  return parsed;
}

describe('parseNewArgs', () => {
  it('defaults to the default Template, no slug, and opening the editor', () => {
    expect(parse('')).toEqual({ slug: '', start: { template: 'default' }, open: true });
  });

  it('takes the slug from the positional words, normalized', () => {
    expect(request('waves').slug).toBe('waves');
    expect(request('Soft waves').slug).toBe('soft-waves');
    expect(parseNewArgs(['soft waves'])).toMatchObject({ slug: 'soft-waves' });
  });

  it('reads -t / --template with its value', () => {
    expect(parse('-t feedback trails')).toEqual({ slug: 'trails', start: { template: 'feedback' }, open: true });
    expect(request('--template feedback').start).toEqual({ template: 'feedback' });
    expect(request('--template=feedback').start).toEqual({ template: 'feedback' });
  });

  it('reads --from with an optional Sketch name', () => {
    expect(request('--from').start).toEqual({ from: null });
    expect(parse('--from 2026-09-27-waves waves')).toEqual({ slug: 'waves', start: { from: '2026-09-27-waves' }, open: true });
    expect(request('--from=2026-09-27-waves').start).toEqual({ from: '2026-09-27-waves' });
    // A slug before --from, or another flag after it, leaves --from without a name (the latest Sketch).
    expect(parse('waves --from')).toEqual({ slug: 'waves', start: { from: null }, open: true });
    expect(parse('--from --no-open waves')).toEqual({ slug: 'waves', start: { from: null }, open: false });
  });

  it('reads --no-open', () => {
    expect(parse('--no-open waves')).toEqual({ slug: 'waves', start: { template: 'default' }, open: false });
  });

  it('reads -h / --help', () => {
    expect(parse('-h')).toEqual({ help: true });
    expect(parse('waves --help')).toEqual({ help: true });
  });

  it('rejects -t together with --from', () => {
    expect(() => parse('-t feedback --from')).toThrow(UsageError);
    expect(() => parse('--from x -t feedback')).toThrow(/-t.*--from|--from.*-t/);
  });

  it('rejects a slug that normalizes to nothing', () => {
    expect(() => parse('파도')).toThrow(UsageError);
    expect(() => parseNewArgs([''])).toThrow(/slug/);
  });

  it('rejects -t without a value, and unknown flags', () => {
    expect(() => parse('-t')).toThrow(UsageError);
    expect(() => parse('-t --no-open')).toThrow(UsageError);
    expect(() => parse('--open')).toThrow(/--open/);
  });
});
