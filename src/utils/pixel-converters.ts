// ImageDecoder版（高速・Chrome/Edge）
const blobToPixelsWithImageDecoder = async (
  blob: Blob
): Promise<{ pixels: Uint8Array; width: number; height: number }> => {
  const arrayBuffer = await blob.arrayBuffer();
  const decoder = new ImageDecoder({ data: arrayBuffer, type: blob.type });
  const { image } = await decoder.decode();
  const width = image.displayWidth;
  const height = image.displayHeight;
  const buf = new Uint8Array(width * height * 4);
  await image.copyTo(buf, { format: "RGBA" });
  image.close();
  return { pixels: buf, width, height };
};

// Canvas版（フォールバック・Safari）
// NOTE:「Safari は ImageDecoder をサポートしていない」ため、エラーで描画できない問題がある
const blobToPixelsWithCanvas = async (
  blob: Blob
): Promise<{ pixels: Uint8Array; width: number; height: number }> => {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    // 読み戻し専用 (GPU readback を避ける。未対応ブラウザでは無視される)
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to get 2d context");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      pixels: new Uint8Array(imageData.data.buffer),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ブラウザの対応状況に応じて適切な実装を選択
let useImageDecoder = typeof ImageDecoder !== "undefined";

export const blobToPixels = async (
  blob: Blob
): Promise<{
  pixels: Uint8Array;
  width: number;
  height: number;
}> => {
  // ImageDecoderが利用可能な場合、まず試す
  if (useImageDecoder) {
    try {
      return await blobToPixelsWithImageDecoder(blob);
    } catch (e) {
      console.log("🧑‍🎨 : ImageDecoder failed, falling back to Canvas", e);
      useImageDecoder = false; // 次回から直接Canvas版を使う
      return await blobToPixelsWithCanvas(blob);
    }
  }
  // ImageDecoderが使えない、または以前失敗した場合
  return await blobToPixelsWithCanvas(blob);
};
