import { getCurrentPosition } from "../../utils/position";
import { llzToTilePixel } from "../../utils/coordinate";
import { Toast } from "../../components/toast";
import { ensureFontLoaded } from "./font-loader";
import { textToBlob } from "./text-renderer";
import type { TextInstance } from "./ui";
import {
  addImageToOverlayLayers,
  removePreparedOverlayImageByKey,
} from "@/features/tile-draw";

// ========================================
// Text drawing operations
// ========================================

export const drawText = async (
  text: string,
  font: string
): Promise<TextInstance | null> => {
  const position = getCurrentPosition();
  if (!position) {
    Toast.error("Position not found");
    return null;
  }

  const coords = llzToTilePixel(position.lat, position.lng);
  const key = `text_${Date.now()}`;

  await ensureFontLoaded();
  const blob = await textToBlob(text, font);
  const file = new File([blob], "text.png", { type: "image/png" });

  await addImageToOverlayLayers(
    file,
    [coords.TLX, coords.TLY, coords.PxX, coords.PxY],
    key
  );

  console.log("🧑‍🎨 : Text drawn at position", coords);

  return {
    key,
    text,
    font,
    coords: {
      TLX: coords.TLX,
      TLY: coords.TLY,
      PxX: coords.PxX,
      PxY: coords.PxY,
    },
  };
};

export const moveText = async (
  instance: TextInstance,
  direction: "up" | "down" | "left" | "right"
): Promise<void> => {
  const deltaMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const delta = deltaMap[direction];
  instance.coords.PxX += delta.x;
  instance.coords.PxY += delta.y;

  await ensureFontLoaded();
  const blob = await textToBlob(instance.text, instance.font);
  const file = new File([blob], "text.png", { type: "image/png" });

  removePreparedOverlayImageByKey(instance.key);
  await addImageToOverlayLayers(
    file,
    [
      instance.coords.TLX,
      instance.coords.TLY,
      instance.coords.PxX,
      instance.coords.PxY,
    ],
    instance.key
  );

  console.log("🧑‍🎨 : Text moved", direction, instance.coords);
};

export const deleteText = (
  key: string,
  textInstances: TextInstance[]
): TextInstance[] => {
  removePreparedOverlayImageByKey(key);
  console.log("🧑‍🎨 : Text deleted", key);
  return textInstances.filter((i) => i.key !== key);
};
