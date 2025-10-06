import { llzToTilePixel } from "./coordinate";

export const flyToPosition = (
  lat: number,
  lng: number,
  zoom: number = 16
): boolean => {
  window.postMessage(
    {
      source: "wplace-studio-flyto",
      lat,
      lng,
      zoom,
    },
    "*"
  );
  return true;
};

/**
 * タイルキャッシュから緯度経度の色を取得
 */
export async function getPixelColorFromTile(
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> {
  const coords = llzToTilePixel(lat, lng);

  const tileSnapshot = window.mrWplace?.tileSnapshot;
  if (!tileSnapshot) {
    console.log("🧑‍🎨 : tileSnapshot not available");
    return null;
  }

  const tileBlob = await tileSnapshot.getTmpTile(coords.TLX, coords.TLY);
  if (!tileBlob) {
    console.log("🧑‍🎨 : Tile not cached:", coords.TLX, coords.TLY);
    return null;
  }

  const bitmap = await createImageBitmap(tileBlob);

  const canvas = new OffscreenCanvas(1, 1);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, coords.PxX, coords.PxY, 1, 1, 0, 0, 1, 1);

  const imageData = ctx.getImageData(0, 0, 1, 1);
  return {
    r: imageData.data[0],
    g: imageData.data[1],
    b: imageData.data[2],
    a: imageData.data[3],
  };
}
