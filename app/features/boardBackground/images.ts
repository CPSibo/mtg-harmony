/**
 * Encodes straight RGBA pixels as a PNG and returns a blob URL for it, or
 * null where the browser can't (no canvas, as under happy-dom). Revoke the
 * URL once nothing shows it.
 */
export function bitmapUrl(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
): Promise<string | null> {
  return draw(width, height, (ctx) =>
    ctx.putImageData(new ImageData(pixels, width, height), 0, 0),
  );
}

/**
 * Renders the square SVG behind a CSS `url("…")` value at `px` × `px` and
 * returns a blob URL for it as a PNG, or null where the browser can't. A
 * bitmap background pans as a texture; a large SVG one with clips and masks
 * can be drawn again on every frame. Revoke the URL once nothing shows it.
 */
export async function rasterUrl(
  value: string,
  px: number,
  timeoutMs = 2000,
): Promise<string | null> {
  const url = cssUrl(value);
  if (!url) return null;
  try {
    const img = new Image();
    img.src = url;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const decoded = await Promise.race([
      img.decode().then(() => true),
      new Promise<false>(
        (done) => (timer = setTimeout(done, timeoutMs, false)),
      ),
    ]);
    clearTimeout(timer);
    if (!decoded) return null;
    // Drawn straight onto a canvas, the SVG rasterises on the main thread when
    // the canvas is encoded: about 50 ms at 3200 px, a dropped frame or three
    // mid-zoom. Chrome rasterises it for createImageBitmap off the main thread,
    // at the size asked for, so it stays as sharp.
    const bitmap =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(img, {
            resizeWidth: px,
            resizeHeight: px,
          }).catch(() => null)
        : null;
    if (!bitmap)
      return await draw(px, px, (ctx) => ctx.drawImage(img, 0, 0, px, px));
    try {
      return await draw(px, px, (ctx) => ctx.drawImage(bitmap, 0, 0));
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Paints a `width` × `height` canvas and returns a blob URL of it as a PNG. */
async function draw(
  width: number,
  height: number,
  paint: (ctx: Context2D) => void,
): Promise<string | null> {
  try {
    let blob: Blob | null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      paint(ctx);
      blob = await canvas.convertToBlob();
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      paint(ctx);
      blob = await new Promise((done) => canvas.toBlob(done));
    }
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/** The URL inside a CSS `url("…")` value. */
const cssUrl = (value: string) => /^url\("(.*)"\)$/s.exec(value)?.[1];

/**
 * Resolves once the images behind these CSS `url("…")` values are decoded, so
 * a background shown next paints whole rather than piece by piece. Gives up
 * after `timeoutMs`, and ignores images that fail: a slow or broken image
 * must never keep the board hidden.
 */
export async function preloadImages(
  values: readonly string[],
  timeoutMs = 2000,
): Promise<void> {
  const decode = async (value: string) => {
    const url = cssUrl(value);
    if (!url) return;
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      // Shown anyway; the browser paints it when it can.
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.all(values.map(decode)),
    new Promise((done) => (timer = setTimeout(done, timeoutMs))),
  ]);
  clearTimeout(timer);
}
