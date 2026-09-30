/** The part of an image a target shows, in image UV (0..1): `offset + targetUV * scale`. */
export interface CoverCrop {
  offset: [number, number];
  scale: [number, number];
}

/**
 * Where a `imageWidth × imageHeight` image is sampled to cover a `targetWidth × targetHeight`
 * target without stretching (#54): the image keeps its aspect ratio and fills the target, and
 * the side that doesn't fit is cropped equally at both ends.
 */
export function coverCrop(imageWidth: number, imageHeight: number, targetWidth: number, targetHeight: number): CoverCrop {
  // How much wider the image is than the target, as shapes.
  const wider = (imageWidth * targetHeight) / (imageHeight * targetWidth);
  const scale: [number, number] = wider > 1 ? [1 / wider, 1] : [1, wider];
  return { offset: [(1 - scale[0]) / 2, (1 - scale[1]) / 2], scale };
}
