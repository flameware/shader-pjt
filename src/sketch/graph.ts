import type { Diagnostic } from '../diagnostics/diagnostic';
import { MAX_OUTPUT_SIDE, OUTPUT_PRESETS, type OutputSize, parseOutputSize } from '../output/output-size';
import type { BufferFilter, BufferFormat, BufferWrap } from './define';
import { isImageSource, resolveImagePath } from './images';

/** A Channel reading a Pass: the Pass it reads, and whether it reads last frame's output (`prev()`). */
export interface PassChannel {
  pass: string;
  prev: boolean;
}

/** A Channel reading an image file of the Sketch folder (#54). */
export interface ImageChannel {
  /** Project-relative path of the image. */
  image: string;
}

/** A resolved Channel. */
export type ChannelRef = PassChannel | ImageChannel;

/** How big a Pass's buffer is: relative to the render size, or fixed pixels. */
export type BufferSize = { scale: number } | { size: [number, number] };

export interface BufferSpec {
  format: BufferFormat;
  /** Already resolved against the device (32F linear falls back to nearest without the extension). */
  filter: BufferFilter;
  wrap: BufferWrap;
  size: BufferSize;
}

export interface PassNode {
  name: string;
  /** Project-relative path of the Pass's `.frag`. */
  file: string;
  /** `channels[i]` feeds `iChannel<i>`. */
  channels: ChannelRef[];
  buffer: BufferSpec;
  /** True when some Pass reads this one with `prev()`, so it needs two buffers (Feedback). */
  feedback: boolean;
}

export interface PassGraph {
  title?: string;
  /** The `sketch.ts` default Output size (#8 decision 1); `window` when absent. */
  output?: OutputSize;
  /** Every Pass of the Sketch, including ones that don't run (they are still compiled). */
  passes: Record<string, PassNode>;
  /** The Passes that run each frame, in order; `main` is always last. */
  order: string[];
  /** Project-relative paths of the images the running Passes read, each once. */
  images: string[];
}

export interface PassGraphInput {
  /** Project-relative path of `sketch.ts`, for diagnostics (whether or not it exists). */
  sketchFile: string;
  /** Pass name → project-relative `.frag` path, for the Sketch's top-level `.frag` files. */
  passFiles: Record<string, string>;
  /** Project-relative paths of the image files under `sketches/`, for image Channels. */
  imageFiles: readonly string[];
  /** The default export of `sketch.ts`, or `undefined` when the Sketch has none. */
  config: unknown;
  /** Whether the device has `OES_texture_float_linear`. */
  floatLinear: boolean;
}

export interface PassGraphResult {
  /** `null` when there is any error. */
  graph: PassGraph | null;
  diagnostics: Diagnostic[];
}

/** `iChannel0..3`. */
export const MAX_CHANNELS = 4;

const FORMATS: readonly BufferFormat[] = ['rgba8', 'rgba16f', 'rgba32f'];
const FILTERS: readonly BufferFilter[] = ['linear', 'nearest'];
const WRAPS: readonly BufferWrap[] = ['clamp', 'repeat', 'mirror'];
const SKETCH_KEYS = ['title', 'output', 'passes'];
const PASS_KEYS = ['channels', 'format', 'filter', 'wrap', 'scale', 'size'];
/** The Main pass is drawn at the render size, and its Feedback buffer is always `rgba16f` (#5). */
const NOT_ON_MAIN = ['format', 'scale', 'size'];

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T => values.includes(value as T);
const quoteAll = (values: readonly string[]) => values.map((v) => `'${v}'`).join(', ');

/** Collects problems while `sketch.ts` is read, so all of them are reported at once. */
interface Problems {
  errors: string[];
  warnings: string[];
}

function unknownKeys(raw: Raw, allowed: readonly string[], where: string, problems: Problems): void {
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key)) problems.errors.push(`${where}알 수 없는 키 '${key}' (가능한 키: ${allowed.join(', ')})`);
  }
}

/** What `sketch.ts` may name in a Channel: the Sketch's Passes, and image files under its folder. */
interface ChannelTargets {
  passNames: readonly string[];
  folder: string;
  imageFiles: readonly string[];
}

function parseImageChannel(source: string, prev: boolean, targets: ChannelTargets, at: string, problems: Problems): ImageChannel | null {
  if (prev) {
    problems.errors.push(`${at}: 이미지 '${source}'는 prev()로 읽을 수 없습니다 (이미지는 프레임마다 같습니다)`);
    return null;
  }
  const resolved = resolveImagePath(targets.folder, source);
  if (!resolved.ok) {
    problems.errors.push(`${at}: '${source}': ${resolved.error}`);
    return null;
  }
  if (!targets.imageFiles.includes(resolved.path)) {
    problems.errors.push(`${at}: 없는 이미지 '${source}' (${resolved.path}가 없습니다)`);
    return null;
  }
  return { image: resolved.path };
}

function parseChannels(name: string, raw: unknown, targets: ChannelTargets, problems: Problems): ChannelRef[] {
  const where = `passes.${name}.channels`;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.errors.push(`${where}는 배열이어야 합니다`);
    return [];
  }
  if (raw.length > MAX_CHANNELS) problems.errors.push(`${where}: Channel은 최대 ${MAX_CHANNELS}개입니다 (iChannel0..${MAX_CHANNELS - 1}), 지금 ${raw.length}개`);
  const channels: ChannelRef[] = [];
  raw.slice(0, MAX_CHANNELS).forEach((source: unknown, slot) => {
    const at = `${where}[${slot}] (iChannel${slot})`;
    const ref: PassChannel | null =
      typeof source === 'string'
        ? { pass: source, prev: false }
        : isObject(source) && typeof source.prev === 'string'
          ? { pass: source.prev, prev: true }
          : null;
    if (ref === null) {
      problems.errors.push(`${at}: Pass 이름 문자열, prev('이름'), 또는 './'로 시작하는 이미지 경로여야 합니다`);
    } else if (isImageSource(ref.pass)) {
      const image = parseImageChannel(ref.pass, ref.prev, targets, at, problems);
      if (image) channels.push(image);
    } else if (!targets.passNames.includes(ref.pass)) {
      problems.errors.push(`${at}: 없는 Pass '${ref.pass}' (${ref.pass}.frag가 없습니다)`);
    } else if (ref.pass === 'main' && !ref.prev) {
      problems.errors.push(`${at}: main은 마지막에 실행되므로 이번 프레임의 main은 읽을 수 없습니다. prev('main')을 쓰세요`);
    } else {
      channels.push(ref);
    }
  });
  return channels;
}

function parseSize(name: string, raw: Raw, problems: Problems): BufferSize {
  const where = `passes.${name}`;
  const { scale, size } = raw;
  if (scale !== undefined && size !== undefined) {
    problems.errors.push(`${where}: scale과 size는 함께 쓸 수 없습니다`);
  }
  if (size !== undefined) {
    const valid = Array.isArray(size) && size.length === 2 && size.every((n) => Number.isInteger(n) && n > 0);
    if (valid) return { size: [size[0], size[1]] };
    problems.errors.push(`${where}.size는 양의 정수 두 개 [너비, 높이]여야 합니다`);
  }
  if (scale !== undefined) {
    if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0) return { scale };
    problems.errors.push(`${where}.scale은 0보다 큰 수여야 합니다 (캔버스 대비 배율)`);
  }
  return { scale: 1 };
}

/**
 * Buffer options with their defaults: `rgba16f`/`linear`/`clamp`/`scale: 1`, and `nearest` for
 * `rgba32f`. An explicit `linear` on `rgba32f` needs `OES_texture_float_linear`; without it the
 * buffer falls back to `nearest` with a warning (#10).
 */
function parseBuffer(name: string, raw: Raw, floatLinear: boolean, problems: Problems): BufferSpec {
  const where = `passes.${name}`;
  const pick = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const value = raw[key];
    if (value === undefined) return fallback;
    if (isOneOf(values, value)) return value;
    problems.errors.push(`${where}.${key}: 알 수 없는 값 ${JSON.stringify(value)} (가능한 값: ${quoteAll(values)})`);
    return fallback;
  };
  const format = pick('format', FORMATS, 'rgba16f');
  let filter = pick('filter', FILTERS, format === 'rgba32f' ? 'nearest' : 'linear');
  if (format === 'rgba32f' && filter === 'linear' && !floatLinear) {
    problems.warnings.push(`${where}: 이 기기는 OES_texture_float_linear가 없어 rgba32f 버퍼에 linear 필터를 쓸 수 없습니다. nearest로 대신합니다`);
    filter = 'nearest';
  }
  return { format, filter, wrap: pick('wrap', WRAPS, 'clamp'), size: parseSize(name, raw, problems) };
}

/** Reads the `sketch.ts` value into per-Pass Channels and buffers. Passes it doesn't mention get the defaults. */
function parseConfig(config: unknown, passFiles: Record<string, string>, images: Omit<ChannelTargets, 'passNames'>, floatLinear: boolean, problems: Problems) {
  const passNames = Object.keys(passFiles);
  const result: { title?: string; output?: OutputSize; passes: Record<string, { channels: ChannelRef[]; buffer: BufferSpec }> } = { passes: {} };
  let passConfigs: Raw = {};

  if (config !== undefined) {
    if (!isObject(config)) {
      problems.errors.push('sketch.ts는 export default defineSketch({ ... })여야 합니다');
    } else {
      unknownKeys(config, SKETCH_KEYS, '', problems);
      if (config.title !== undefined && typeof config.title !== 'string') problems.errors.push('title은 문자열이어야 합니다');
      else if (typeof config.title === 'string') result.title = config.title;
      if (config.output !== undefined) {
        const output = parseOutputSize(config.output);
        if (output !== undefined) result.output = output;
        else problems.errors.push(`output: Output size는 'window', ${quoteAll(Object.keys(OUTPUT_PRESETS))} 중 하나이거나 ${MAX_OUTPUT_SIDE} 이하의 양의 정수 두 개 [너비, 높이]여야 합니다`);
      }
      if (config.passes !== undefined && !isObject(config.passes)) problems.errors.push('passes는 { 이름: { ... } } 객체여야 합니다');
      else if (isObject(config.passes)) passConfigs = config.passes;
    }
  }

  for (const name of Object.keys(passConfigs)) {
    if (!passNames.includes(name)) problems.errors.push(`passes.${name}: 없는 Pass '${name}' (${name}.frag가 없습니다)`);
  }
  for (const name of passNames) {
    const raw = passConfigs[name] ?? {};
    if (!isObject(raw)) {
      problems.errors.push(`passes.${name}는 객체여야 합니다`);
      result.passes[name] = { channels: [], buffer: parseBuffer(name, {}, floatLinear, problems) };
      continue;
    }
    unknownKeys(raw, PASS_KEYS, `passes.${name}: `, problems);
    if (name === 'main') {
      for (const key of NOT_ON_MAIN) {
        if (raw[key] !== undefined) problems.errors.push(`passes.main.${key}: main에는 쓸 수 없습니다 (main은 캔버스 크기, rgba16f)`);
      }
    }
    const channels = parseChannels(name, raw.channels, { passNames, ...images }, problems);
    const buffer = parseBuffer(name, name === 'main' ? { filter: raw.filter, wrap: raw.wrap } : raw, floatLinear, problems);
    result.passes[name] = { channels, buffer };
  }
  return result;
}


/** The Passes that must run for `main`: everything it reads, this frame or through `prev()`, transitively. */
function reachableFromMain(passes: Record<string, PassNode>): Set<string> {
  const seen = new Set<string>();
  const visit = (name: string) => {
    const node = passes[name];
    if (!node || seen.has(name)) return;
    seen.add(name);
    for (const channel of passChannels(node)) visit(channel.pass);
  };
  visit('main');
  return seen;
}

/** The Channels of a Pass that read other Passes (not images). */
const passChannels = (node: PassNode) => node.channels.filter((c): c is PassChannel => 'pass' in c);

/** This frame's references of a Pass (the ones that constrain order). */
const thisFrame = (node: PassNode) => passChannels(node).filter((c) => !c.prev).map((c) => c.pass);

/**
 * Kahn's algorithm over this frame's references, always taking the ready Pass that sorts first
 * by name; `main` is held back to the end. On a cycle, returns one loop (`a → b → a`) instead.
 */
function topologicalOrder(names: string[], passes: Record<string, PassNode>): { order: string[] } | { cycle: string[] } {
  const waitingOn = new Map(names.map((name) => [name, new Set(thisFrame(passes[name]!))]));
  const order: string[] = [];
  while (waitingOn.size > 0) {
    const ready = [...waitingOn].filter(([name, deps]) => name !== 'main' && deps.size === 0).map(([name]) => name);
    const next = ready.sort()[0] ?? (waitingOn.size === 1 && waitingOn.get('main')?.size === 0 ? 'main' : undefined);
    if (next === undefined) return { cycle: findCycle([...waitingOn.keys()].sort(), passes) };
    order.push(next);
    waitingOn.delete(next);
    for (const deps of waitingOn.values()) deps.delete(next);
  }
  return { order };
}

/**
 * One loop among `stuck` (the Passes Kahn couldn't order), found by walking references from the
 * first one. Callers reject this-frame reads of `main` beforehand, so every stuck Pass waits on
 * another stuck Pass and the walk must come back to one it has seen.
 */
function findCycle(stuck: string[], passes: Record<string, PassNode>): string[] {
  const start = stuck.find((name) => name !== 'main') ?? stuck[0]!;
  const path: string[] = [];
  let current = start;
  while (!path.includes(current)) {
    path.push(current);
    current = thisFrame(passes[current]!).filter((dep) => stuck.includes(dep)).sort()[0]!;
  }
  return [...path.slice(path.indexOf(current)), current];
}

/**
 * Validates a Sketch's `sketch.ts` against its `.frag` files and works out which Passes run and
 * in what order: a topological sort of this frame's Channel references (`prev()` doesn't order),
 * name order where it doesn't matter, `main` last.
 */
export function buildPassGraph({ sketchFile, passFiles, imageFiles, config, floatLinear }: PassGraphInput): PassGraphResult {
  const problems: Problems = { errors: [], warnings: [] };
  if (!('main' in passFiles)) problems.errors.push('main.frag가 없습니다 (Main pass는 필수)');
  const folder = sketchFile.slice(0, sketchFile.lastIndexOf('/'));
  const parsed = parseConfig(config, passFiles, { folder, imageFiles }, floatLinear, problems);
  const diagnostics: Diagnostic[] = [
    ...problems.errors.map((message): Diagnostic => ({ severity: 'error', file: sketchFile, message })),
    ...problems.warnings.map((message): Diagnostic => ({ severity: 'warning', file: sketchFile, message })),
  ];
  if (problems.errors.length > 0) return { graph: null, diagnostics };

  const passes: Record<string, PassNode> = {};
  for (const [name, file] of Object.entries(passFiles)) {
    passes[name] = { name, file, ...parsed.passes[name]!, feedback: false };
  }
  for (const node of Object.values(passes)) {
    for (const channel of passChannels(node)) if (channel.prev) passes[channel.pass]!.feedback = true;
  }
  const running = reachableFromMain(passes);
  for (const node of Object.values(passes).sort((a, b) => a.name.localeCompare(b.name))) {
    if (running.has(node.name)) continue;
    diagnostics.push({ severity: 'warning', file: node.file, message: `참조되지 않은 Pass '${node.name}': 컴파일만 하고 실행하지 않습니다` });
  }
  // Sorting every Pass (not just the running ones) finds cycles among unreferenced Passes too.
  // Unreferenced Passes never feed running ones, so dropping them leaves the running order as is.
  const sorted = topologicalOrder(Object.keys(passes), passes);
  if ('cycle' in sorted) {
    const loop = sorted.cycle.join(' → ');
    diagnostics.push({ severity: 'error', file: sketchFile, message: `순환 참조: ${loop} (이전 프레임을 읽으려면 prev()를 쓰세요)` });
    return { graph: null, diagnostics };
  }
  const order = sorted.order.filter((name) => running.has(name));
  const images = order.flatMap((name) => passes[name]!.channels.flatMap((c) => ('image' in c ? [c.image] : [])));
  const graph: PassGraph = { passes, order, images: [...new Set(images)] };
  if (parsed.title !== undefined) graph.title = parsed.title;
  if (parsed.output !== undefined) graph.output = parsed.output;
  return { graph, diagnostics };
}
