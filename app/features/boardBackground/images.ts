/**
 * Encodes straight RGBA pixels as a PNG and returns a blob URL for it, or
 * null where the browser can't (no canvas, as under happy-dom). Revoke the
 * URL once nothing shows it.
 */
export async function bitmapUrl(
  pixels: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const data = new ImageData(pixels, width, height);
    let blob: Blob | null;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(data, 0, 0);
      blob = await canvas.convertToBlob();
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(data, 0, 0);
      blob = await new Promise((done) => canvas.toBlob(done));
    }
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

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
    const url = /^url\("(.*)"\)$/s.exec(value)?.[1];
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
