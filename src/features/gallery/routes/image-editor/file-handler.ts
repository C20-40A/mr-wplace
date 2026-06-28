import { DrawPosition } from "../../../../states/galleryStorage";

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
 * 画像サイズチェック・3択ダイアログ表示
 * 1000px超えたら確認→リサイズ/編集/直接追加
 */
export async function showImageSizeDialog(
  dataUrl: string,
  _container: HTMLElement,
): Promise<{ action: "resize" | "edit" | "addToGallery"; dataUrl: string }> {
  return { action: "edit", dataUrl };
};

/**
 * CanvasからBlob生成
 * Firefox: canvas汚染(tainted)に対応するためgetImageData経由
 */
export async function createBlobFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  try {
    // 通常のtoBlobを試行
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("toBlob failed"));
        }
      }, "image/png");
    });
  } catch (error) {
    console.log("🧑‍🎨 : toBlob failed, using getImageData fallback", error);

    // フォールバック: getImageData経由でBlob作成
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // 新しいcleanなcanvasを作成
    const cleanCanvas = document.createElement("canvas");
    cleanCanvas.width = canvas.width;
    cleanCanvas.height = canvas.height;
    const cleanCtx = cleanCanvas.getContext("2d");
    if (!cleanCtx) throw new Error("Failed to get clean canvas context");

    cleanCtx.putImageData(imageData, 0, 0);

    // clean canvasからtoBlob
    return new Promise<Blob>((resolve, reject) => {
      cleanCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from clean canvas"));
        }
      }, "image/png");
    });
  }
}

/**
 * Blob→DataURL変換
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Failed to convert blob to dataUrl"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Blobダウンロード
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * ファイル名からタイトル/座標情報抽出
 * 形式: ${TLX}-${TLY}-${PxX}-${PxY}.png or ${title}_${TLX}-${TLY}-${PxX}-${PxY}.png
 */
export const parseImageMetadataFromFileName = (
  fileName: string,
): { title?: string; drawPosition: DrawPosition | null } => {
  const match = fileName.match(/^(?:(.+)_)?(\d+)-(\d+)-(\d+)-(\d+)\.png$/i);
  if (!match) return { drawPosition: null };

  return {
    title: match[1],
    drawPosition: {
      TLX: parseInt(match[2], 10),
      TLY: parseInt(match[3], 10),
      PxX: parseInt(match[4], 10),
      PxY: parseInt(match[5], 10),
    },
  };
};

export const parseDrawPositionFromFileName = (
  fileName: string,
): DrawPosition | null => parseImageMetadataFromFileName(fileName).drawPosition;
