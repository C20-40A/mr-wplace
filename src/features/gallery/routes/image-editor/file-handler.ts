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
 * 画像サイズチェック・3択ダイアログ表示
 * 500px超えたら確認→リサイズ/編集/直接追加
 */
export async function showImageSizeDialog(
  dataUrl: string,
  container: HTMLElement
): Promise<{ action: "resize" | "edit" | "addToGallery"; dataUrl: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const maxSize = 500;
      const needsResize = img.width > maxSize || img.height > maxSize;

      if (!needsResize) {
        resolve({ action: "edit", dataUrl });
        return;
      }

      // カスタムダイアログ表示
      const action = await showThreeChoiceDialog(
        img.width,
        img.height,
        maxSize,
        container
      );

      if (action === "resize") {
        // リサイズ処理
        const scale = maxSize / Math.max(img.width, img.height);
        const newWidth = Math.floor(img.width * scale);
        const newHeight = Math.floor(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ action: "edit", dataUrl });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        console.log(
          `🧑‍🎨 : Resized image: ${img.width}x${img.height} → ${newWidth}x${newHeight}`
        );
        resolve({ action: "edit", dataUrl: canvas.toDataURL("image/png") });
      } else {
        resolve({ action, dataUrl });
      }
    };
    img.src = dataUrl;
  });
}

/**
 * 3択ダイアログ表示（オーバーレイとして追加）
 */
function showThreeChoiceDialog(
  width: number,
  height: number,
  maxSize: number,
  container: HTMLElement
): Promise<"resize" | "edit" | "addToGallery"> {
  return new Promise((resolve) => {
    // ダイアログHTML生成（オーバーレイ）
    const dialogOverlay = document.createElement("div");
    dialogOverlay.id = "wps-dialog-overlay";
    dialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      background: white;
    `;

    dialogOverlay.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 0.5rem; text-align: center; max-width: 90%;">
        <p style="font-weight: bold; margin-bottom: 1rem;">${t`${"large_image_resize_confirm"}`}</p>
        <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">${t`${"current_size"}`}: ${width} x ${height}px</p>
        <p style="font-size: 0.875rem; margin-bottom: 2rem;">${t`${"resize_to"}`}: ${maxSize}px</p>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 300px; margin: 0 auto;">
          <button id="wps-dialog-resize" class="btn btn-primary">${t`${"resize_image"}`}</button>
          <button id="wps-dialog-edit" class="btn">${t`${"edit_image"}`}</button>
          <button id="wps-dialog-add" class="btn btn-ghost" style="font-size: 0.75rem;">${t`${"add_to_gallery_directly"}`}</button>
        </div>
      </div>
    `;

    container.style.position = "relative";
    container.appendChild(dialogOverlay);

    // ボタンイベント
    const resizeBtn = dialogOverlay.querySelector("#wps-dialog-resize");
    const editBtn = dialogOverlay.querySelector("#wps-dialog-edit");
    const addBtn = dialogOverlay.querySelector("#wps-dialog-add");

    const handleChoice = (action: "resize" | "edit" | "addToGallery") => {
      dialogOverlay.remove();
      resolve(action);
    };

    resizeBtn?.addEventListener("click", () => handleChoice("resize"));
    editBtn?.addEventListener("click", () => handleChoice("edit"));
    addBtn?.addEventListener("click", () => handleChoice("addToGallery"));
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
    reader.onerror = () =>
      reject(new Error("Failed to convert blob to dataUrl"));
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
