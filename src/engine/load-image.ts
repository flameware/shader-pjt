/**
 * Decodes an image file for an image Channel (#54): the values as the file stores them (no
 * colour-space conversion, no premultiplied alpha), with its EXIF orientation applied.
 */
export async function loadImage(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}
