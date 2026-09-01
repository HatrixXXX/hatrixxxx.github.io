import sharp from 'sharp';

export const DEFAULT_INPUT_PIXEL_LIMIT = 0x3fff * 0x3fff;

export function animatedFrameHeight(metadata) {
  return metadata.pageHeight ?? metadata.height ?? 0;
}

export function totalAnimatedPixels(metadata) {
  return (metadata.width ?? 0) * animatedFrameHeight(metadata) * Math.max(metadata.pages ?? 1, 1);
}

export function inputPixelLimitReason(metadata, limit = DEFAULT_INPUT_PIXEL_LIMIT) {
  return (metadata.pages ?? 1) > 1 && totalAnimatedPixels(metadata) > limit
    ? 'input-pixel-limit'
    : null;
}

export function readSourceMetadata(source) {
  return sharp(source).metadata();
}
