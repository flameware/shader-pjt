/** The image files a Channel can read (#54). Keep in step with the image glob in `src/main.ts`. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

/**
 * Whether `file` has an image extension, all lower or all upper case. The image glob in
 * `src/main.ts` lists exactly these (a glob can't ignore case), so a mixed-case name is rejected
 * here instead of being reported as missing.
 */
export function isImageFile(file: string): boolean {
  const extension = /\.([^./]+)$/.exec(file)?.[1] ?? '';
  const lower = extension.toLowerCase();
  return (extension === lower || extension === extension.toUpperCase()) && IMAGE_EXTENSIONS.some((e) => e === lower);
}

/** Whether a Channel source names an image rather than a Pass: a relative path, which a Pass name can't be. */
export function isImageSource(source: string): boolean {
  return source.startsWith('./') || source.startsWith('../');
}

/**
 * The project-relative path of the image `source` (a relative path in `sketch.ts`) names, taken
 * against the Sketch `folder`. The image must stay inside that folder and be one of `IMAGE_EXTENSIONS`.
 */
export function resolveImagePath(folder: string, source: string): { ok: true; path: string } | { ok: false; error: string } {
  const parts: string[] = [];
  for (const part of source.split('/')) {
    if (part === '' || part === '.') continue;
    if (part !== '..') parts.push(part);
    else if (parts.pop() === undefined) return { ok: false, error: 'Sketch 폴더 밖의 이미지는 읽을 수 없습니다' };
  }
  if (!isImageFile(parts.at(-1) ?? '')) {
    return { ok: false, error: `지원하지 않는 이미지 형식입니다 (가능한 형식: ${IMAGE_EXTENSIONS.join(', ')}, 확장자는 모두 소문자나 모두 대문자)` };
  }
  return { ok: true, path: [folder, ...parts].join('/') };
}
