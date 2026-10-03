export const JPEG_EXPORT_WIDTH = 1280;
export const JPEG_EXPORT_QUALITY = 0.97;
const MIN_LARGE_EXPORT_CANVAS_WIDTH = 700;

type PatchedCanvasPrototype = typeof HTMLCanvasElement.prototype & {
  __echostarsJpegExportPolicyInstalled?: boolean;
};

function isJpegType(type?: string): boolean {
  return Boolean(type && /^image\/(?:jpeg|jpg)$/i.test(type));
}

function resizeExportCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  if (source.width === JPEG_EXPORT_WIDTH) return source;

  const target = document.createElement('canvas');
  const ratio = source.height / Math.max(1, source.width);
  target.width = JPEG_EXPORT_WIDTH;
  target.height = Math.max(1, Math.round(JPEG_EXPORT_WIDTH * ratio));

  const ctx = target.getContext('2d');
  if (!ctx) return source;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

export function installHighQualityJpegExportPolicy(): void {
  if (typeof HTMLCanvasElement === 'undefined') return;

  const prototype = HTMLCanvasElement.prototype as PatchedCanvasPrototype;
  if (prototype.__echostarsJpegExportPolicyInstalled) return;

  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback,
    type?: string,
    quality?: number
  ): void {
    if (!isJpegType(type) || this.width < MIN_LARGE_EXPORT_CANVAS_WIDTH) {
      originalToBlob.call(this, callback, type, quality);
      return;
    }

    const target = resizeExportCanvas(this);
    originalToBlob.call(target, callback, 'image/jpeg', JPEG_EXPORT_QUALITY);
  };

  HTMLCanvasElement.prototype.toDataURL = function (
    type?: string,
    quality?: number
  ): string {
    if (!isJpegType(type) || this.width < MIN_LARGE_EXPORT_CANVAS_WIDTH) {
      return originalToDataURL.call(this, type, quality);
    }

    const target = resizeExportCanvas(this);
    return originalToDataURL.call(target, 'image/jpeg', JPEG_EXPORT_QUALITY);
  };

  Object.defineProperty(prototype, '__echostarsJpegExportPolicyInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
}

installHighQualityJpegExportPolicy();
