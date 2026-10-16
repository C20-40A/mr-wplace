/**
 * Snapshot thumbnail generation (inject side)
 *
 * Best-effort only: 失敗してもスナップショット保存/読み込みには一切影響させない。
 * タイル一覧で大量のタイルを軽く表示するための、小さな (<=96px) プレビューを生成する。
 */

export const THUMBNAIL_MAX_SIZE = 96;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

const createCanvas = (width: number, height: number): AnyCanvas => {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const canvasToBlob = (canvas: AnyCanvas): Promise<Blob | null> => {
  // OffscreenCanvas 優先（page context）
  if (typeof (canvas as OffscreenCanvas).convertToBlob === "function") {
    const offscreen = canvas as OffscreenCanvas;
    return offscreen
      .convertToBlob({ type: "image/webp", quality: 0.7 })
      .catch(() => offscreen.convertToBlob());
  }

  return new Promise((resolve) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => resolve(blob),
      "image/webp",
      0.7,
    );
  });
};

/**
 * スナップショット blob から縮小サムネイルを生成する。
 * 生成できない場合は null を返す（呼び出し側はプレースホルダを維持する）。
 */
export const generateSnapshotThumbnail = async (
  blob: Blob,
): Promise<Blob | null> => {
  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap !== "function") return null;

    bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none" });

    const srcWidth = bitmap.width;
    const srcHeight = bitmap.height;
    if (!srcWidth || !srcHeight) return null;

    // アスペクト比を保って 96px の箱に収める
    const scale = Math.min(
      THUMBNAIL_MAX_SIZE / srcWidth,
      THUMBNAIL_MAX_SIZE / srcHeight,
    );
    const width = Math.max(1, Math.round(srcWidth * scale));
    const height = Math.max(1, Math.round(srcHeight * scale));

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await canvasToBlob(canvas);
  } catch (error) {
    console.warn("🧑‍🎨 [Snapshot] Thumbnail generation failed:", error);
    return null;
  } finally {
    bitmap?.close?.();
  }
};
