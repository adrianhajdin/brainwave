/** Geometry of the round photo cropper; no React Native imports so it can be unit-tested. */

/** Square crop in image pixels. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Pan/zoom geometry of the crop circle (pure, so it is unit-tested).
 * The image is drawn with `cover` scale × zoom, centred on the circle plus an
 * offset (tx, ty) in screen pixels; the circle must stay fully covered.
 */
export function cropGeometry(img: { width: number; height: number }, circlePx: number) {
  const cover = Math.max(circlePx / img.width, circlePx / img.height);
  const size = (zoom: number) => ({ w: img.width * cover * zoom, h: img.height * cover * zoom });
  const clamp = (zoom: number, tx: number, ty: number) => {
    const { w, h } = size(zoom);
    const mx = Math.max(0, (w - circlePx) / 2);
    const my = Math.max(0, (h - circlePx) / 2);
    return { zoom, tx: Math.min(mx, Math.max(-mx, tx)), ty: Math.min(my, Math.max(-my, ty)) };
  };
  const rect = (zoom: number, tx: number, ty: number): CropRect => {
    const scale = cover * zoom; // screen px per image px
    const side = Math.min(img.width, img.height, Math.round(circlePx / scale));
    const { w, h } = size(zoom);
    const x = Math.round((w / 2 - tx - circlePx / 2) / scale);
    const y = Math.round((h / 2 - ty - circlePx / 2) / scale);
    return {
      originX: Math.min(img.width - side, Math.max(0, x)),
      originY: Math.min(img.height - side, Math.max(0, y)),
      width: side,
      height: side,
    };
  };
  return { cover, size, clamp, rect };
}
