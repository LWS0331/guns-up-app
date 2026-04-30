/**
 * Image compression for the Anthropic vision API.
 *
 * The cap that matters is on the BASE64-ENCODED payload sent to
 * Anthropic, not the raw file size. Base64 adds ~33% overhead, so a
 * ~4.5 MB raw photo becomes ~6 MB encoded and the API rejects it with
 * `image exceeds 5 MB maximum`. The original client-side guards were
 * 5 MB on raw size which let those through.
 *
 * See Railway logs Apr 30 for the failure that triggered this:
 *   `messages.8.content.0.image.source.base64: image exceeds 5 MB
 *    maximum: 6060440 bytes > 5242880 bytes`
 *
 * Used by:
 *  - GunnyChat.tsx (chat photo attach)
 *  - IntelCenter.tsx (Nutrition tab analyze-photo)
 *
 * Strategy:
 * 1. Decode the file into an Image.
 * 2. Draw to a canvas with longest-side capped at MAX_DIM. For most
 *    phone photos this is the dominant savings (e.g. a 4032×3024
 *    iPhone shot becomes 2000×1500).
 * 3. Export as JPEG at QUALITY. Re-encoding to JPEG also strips
 *    EXIF/metadata + recompresses, killing another big chunk.
 * 4. If the result is still > MAX_BYTES, halve quality and try again
 *    (worst case: heavily-detailed PNG screenshots). Bail at QUALITY_FLOOR
 *    so we don't degrade past usefulness.
 *
 * Returns a data URL (`data:image/jpeg;base64,...`). Never throws — if
 * compression fails for any reason, returns the original FileReader output.
 */
export async function compressImageForVision(file: File): Promise<string> {
  const MAX_DIM = 2000;
  const MAX_BYTES = 4_500_000; // headroom under the 5 MB API limit
  const QUALITY_START = 0.85;
  const QUALITY_FLOOR = 0.4;

  const readAsDataURL = (f: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  });

  // SVGs and tiny images: skip the canvas dance. The canvas path also
  // doesn't preserve animated GIFs (we'd flatten them to a single frame).
  if (file.type === 'image/svg+xml' || file.size < 600_000) {
    return readAsDataURL(file);
  }

  try {
    const originalUrl = await readAsDataURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image decode failed'));
      i.src = originalUrl;
    });

    const longest = Math.max(img.width, img.height);
    const scale = longest > MAX_DIM ? MAX_DIM / longest : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return originalUrl;
    ctx.drawImage(img, 0, 0, w, h);

    let quality = QUALITY_START;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    // dataUrl.length is a close proxy for the base64-encoded payload
    // size (header is ~24 bytes). Step quality down if still oversized.
    while (dataUrl.length > MAX_BYTES && quality > QUALITY_FLOOR) {
      quality = Math.max(QUALITY_FLOOR, quality - 0.15);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  } catch (e) {
    console.warn('[compressImageForVision] fallback to raw upload:', e);
    return readAsDataURL(file);
  }
}
