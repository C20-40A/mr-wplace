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
 * Firefox: canvas汚染(tainted)に対応するためgetImageData経由
 */
export async function createBlobFromCanvas(
  canvas: HTMLCanvasElement
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

/**
 * ファイルをテキストとして読み込み
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsText(file);
  });
}

/**
 * Bluemarble JSON形式からdataUrlと座標を抽出
 * タイル結合処理含む
 */
export async function parseBluemarbleJson(
  jsonText: string
): Promise<{ dataUrl: string; drawPosition: DrawPosition }> {
  const json = JSON.parse(jsonText);
  
  // 最初のtemplate取得
  const templateKeys = Object.keys(json.templates);
  if (templateKeys.length === 0) {
    throw new Error("No templates found in JSON");
  }
  
  const template = json.templates[templateKeys[0]];
  
  // coords parse: "1792, 907, 382, 902" → DrawPosition
  const coordsParts = template.coords.split(",").map((s: string) => parseInt(s.trim()));
  if (coordsParts.length !== 4) {
    throw new Error("Invalid coords format");
  }
  
  const drawPosition: DrawPosition = {
    TLX: coordsParts[0],
    TLY: coordsParts[1],
    PxX: coordsParts[2],
    PxY: coordsParts[3],
  };
  
  console.log("🧑‍🎨 : Parsed coords:", drawPosition);
  
  // tiles結合処理
  const tiles = template.tiles;
  const tileEntries = Object.entries(tiles) as Array<[string, string]>;
  
  if (tileEntries.length === 0) {
    throw new Error("No tiles found in template");
  }
  
  // 各tileの位置とサイズ取得
  interface TileInfo {
    tx: number;
    ty: number;
    offsetX: number;
    offsetY: number;
    base64: string;
    image?: HTMLImageElement;
    width?: number;
    height?: number;
  }
  
  const tileInfos: TileInfo[] = tileEntries.map(([key, base64]) => {
    const parts = key.split(",").map(s => parseInt(s));
    return {
      tx: parts[0],
      ty: parts[1],
      offsetX: parts[2],
      offsetY: parts[3],
      base64,
    };
  });
  
  // 全tile画像読み込み
  await Promise.all(
    tileInfos.map(info => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // 中央ピクセル抽出: 3x3 → 1x1
          const originalWidth = img.width;
          const originalHeight = img.height;
          const newWidth = Math.floor(originalWidth / 3);
          const newHeight = Math.floor(originalHeight / 3);
          
          console.log("🧑‍🎨 : Extracting center pixels:", originalWidth, "x", originalHeight, "→", newWidth, "x", newHeight);
          
          // 元画像からImageData取得
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = originalWidth;
          tempCanvas.height = originalHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) {
            reject(new Error("Failed to get temp canvas context"));
            return;
          }
          tempCtx.drawImage(img, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
          
          // 中央ピクセル抽出Canvas作成
          const extractedCanvas = document.createElement('canvas');
          extractedCanvas.width = newWidth;
          extractedCanvas.height = newHeight;
          const extractedCtx = extractedCanvas.getContext('2d');
          if (!extractedCtx) {
            reject(new Error("Failed to get extracted canvas context"));
            return;
          }
          const extractedImageData = extractedCtx.createImageData(newWidth, newHeight);
          
          // 中央ピクセルのみコピー
          for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
              const srcX = x * 3 + 1;
              const srcY = y * 3 + 1;
              const srcIndex = (srcY * originalWidth + srcX) * 4;
              const dstIndex = (y * newWidth + x) * 4;
              
              extractedImageData.data[dstIndex] = imageData.data[srcIndex];
              extractedImageData.data[dstIndex + 1] = imageData.data[srcIndex + 1];
              extractedImageData.data[dstIndex + 2] = imageData.data[srcIndex + 2];
              extractedImageData.data[dstIndex + 3] = imageData.data[srcIndex + 3];
            }
          }
          
          extractedCtx.putImageData(extractedImageData, 0, 0);
          
          // 抽出結果をImageに変換
          const extractedImg = new Image();
          extractedImg.onload = () => {
            info.image = extractedImg;
            info.width = newWidth;
            info.height = newHeight;
            resolve();
          };
          extractedImg.onerror = () => reject(new Error("Failed to load extracted image"));
          extractedImg.src = extractedCanvas.toDataURL('image/png');
        };
        img.onerror = () => reject(new Error(`Failed to load tile image: ${info.tx},${info.ty}`));
        
        // base64形式判定: data:プレフィックス確認
        const base64Data = info.base64.startsWith("data:") 
          ? info.base64 
          : `data:image/png;base64,${info.base64}`;
        img.src = base64Data;
      });
    })
  );
  
  // Canvas範囲計算: coords基準
  const baseTX = drawPosition.TLX;
  const baseTY = drawPosition.TLY;
  const baseOffsetX = drawPosition.PxX;
  const baseOffsetY = drawPosition.PxY;
  
  let maxWidth = 0;
  let maxHeight = 0;
  
  for (const info of tileInfos) {
    const startX = (info.tx - baseTX) * 1000 + info.offsetX - baseOffsetX;
    const startY = (info.ty - baseTY) * 1000 + info.offsetY - baseOffsetY;
    maxWidth = Math.max(maxWidth, startX + (info.width || 0));
    maxHeight = Math.max(maxHeight, startY + (info.height || 0));
  }
  
  console.log("🧑‍🎨 : Canvas size:", maxWidth, "x", maxHeight);
  console.log("🧑‍🎨 : Tile count:", tileInfos.length);
  
  // Canvas作成・結合
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  
  // 各tile描画: coords基準
  for (const info of tileInfos) {
    if (!info.image) continue;
    
    const startX = (info.tx - baseTX) * 1000 + info.offsetX - baseOffsetX;
    const startY = (info.ty - baseTY) * 1000 + info.offsetY - baseOffsetY;
    
    ctx.drawImage(info.image, startX, startY);
    console.log("🧑‍🎨 : Drew tile at", startX, startY, "size", info.width, "x", info.height);
  }
  
  const dataUrl = canvas.toDataURL("image/png");
  console.log("🧑‍🎨 : Combined image size:", maxWidth, "x", maxHeight);
  
  return { dataUrl, drawPosition };
}
