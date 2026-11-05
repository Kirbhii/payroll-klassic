/**
 * Reads an image file and returns a downscaled data URL that is small enough to
 * live inside the browser's localStorage alongside the rest of the payroll data.
 *
 * A 3000px phone photo would otherwise eat several megabytes and blow the
 * storage quota, so the longest edge is capped and re-encoded.
 */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

const KEEP_ALPHA = ["image/png", "image/webp", "image/svg+xml", "image/gif"];

export function isSupportedImage(file: File): boolean {
  return file.type.startsWith("image/");
}

/** Loads any image format the browser can decode, including SVG. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be opened."));
    };
    img.src = url;
  });
}

export async function fileToLogoDataUrl(file: File, maxEdge = 320): Promise<string> {
  if (!isSupportedImage(file)) {
    throw new Error("That file is not an image.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image is too large — please pick one under 6 MB.");
  }

  const img = await loadImage(file);

  // An SVG may report no intrinsic size; fall back to the cap in that case.
  const naturalWidth = img.naturalWidth || maxEdge;
  const naturalHeight = img.naturalHeight || maxEdge;
  const scale = Math.min(1, maxEdge / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");

  ctx.drawImage(img, 0, 0, width, height);

  const keepAlpha = KEEP_ALPHA.includes(file.type);
  return keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.86);
}
