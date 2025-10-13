import { t } from "../../../../i18n/manager";
import { DrawPosition } from "../../storage";

/**
 * ファイルをDataURL形式で読み込み
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

/**
 * 画像サイズチェック・リサイズ確認
 * 500px超えたら確認→リサイズ
 */
export async function resizeImageIfNeeded(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxSize = 500;
      const needsResize = img.width > maxSize || img.height > maxSize;

      if (!needsResize) {
        resolve(dataUrl);
        return;
      }

      const shouldResize = confirm(
        t`${"large_image_resize_confirm"}\n\n` +
          t`${"current_size"}` +
          `: ${img.width} x ${img.height}px\n` +
          t`${"resize_to"}` +
          `: ${maxSize}px`
      );

      if (!shouldResize) {
        resolve(dataUrl);
        return;
      }

      // リサイズ処理
      const scale = maxSize / Math.max(img.width, img.height);
      const newWidth = Math.floor(img.width * scale);
      const newHeight = Math.floor(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      console.log(
        `🧑‍🎨 : Resized image: ${img.width}x${img.height} → ${newWidth}x${newHeight}`
      );
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = dataUrl;
  });
}

/**
 * CanvasからBlob生成
 */
export async function createBlobFromCanvas(
  canvas: HTMLCanvasElement
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to create blob from canvas"));
      }
    }, "image/png");
  });
}

/**
 * Blob→DataURL変換
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to convert blob to dataUrl"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Blobダウンロード
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ファイル名から座標情報抽出
 * 形式: ${TLX}-${TLY}-${PxX}-${PxY}.png
 */
export function parseDrawPositionFromFileName(
  fileName: string
): DrawPosition | null {
  const match = fileName.match(/^(\d+)-(\d+)-(\d+)-(\d+)\.png$/);
  if (!match) return null;

  return {
    TLX: parseInt(match[1]),
    TLY: parseInt(match[2]),
    PxX: parseInt(match[3]),
    PxY: parseInt(match[4]),
  };
}
