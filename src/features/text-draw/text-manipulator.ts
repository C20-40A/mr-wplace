import { getCurrentPosition } from "../../utils/position";
import { latLngToTilePixel } from "../../utils/coordinate";
import { Toast } from "../../components/toast";
import { ensureFontLoaded } from "./font-loader";
import { textToBlob } from "./text-renderer";
import type { TextInstance } from "./ui";
import { TextLayerStorage } from "./text-layer-storage";
import { sendTextLayersToInject } from "@/content";

// ========================================
// Text drawing operations
// ========================================

export const drawText = async (
  text: string,
  font: string,
  colorId: number,
  lineSpacing: number,
): Promise<TextInstance | null> => {
  const position = getCurrentPosition();
  if (!position) {
    Toast.error("Position not found");
    return null;
  }

  const coords = latLngToTilePixel(position.lat, position.lng);
  const key = `text_${Date.now()}`;

  await ensureFontLoaded();
  const blob = await textToBlob(text, font, colorId, lineSpacing);

  // Convert blob to dataUrl
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  // Save to text layer storage
  const textLayerStorage = new TextLayerStorage();
  await textLayerStorage.save({
    key,
    text,
    font,
    lineSpacing,
    coords: {
      TLX: coords.TLX,
      TLY: coords.TLY,
      PxX: coords.PxX,
      PxY: coords.PxY,
    },
    dataUrl,
    timestamp: Date.now(),
    colorId,
  });

  // Notify inject side
  await sendTextLayersToInject();

  console.log("🧑‍🎨 : Text drawn at position", coords);

  return {
    key,
    text,
    font,
    lineSpacing,
    coords: {
      TLX: coords.TLX,
      TLY: coords.TLY,
      PxX: coords.PxX,
      PxY: coords.PxY,
    },
    colorId,
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

  // Update text layer storage
  const textLayerStorage = new TextLayerStorage();
  const existing = await textLayerStorage.get(instance.key);

  if (existing) {
    await textLayerStorage.save({
      ...existing,
      coords: {
        TLX: instance.coords.TLX,
        TLY: instance.coords.TLY,
        PxX: instance.coords.PxX,
        PxY: instance.coords.PxY,
      },
    });

    // Notify inject side
    await sendTextLayersToInject();
  }

  console.log("🧑‍🎨 : Text moved", direction, instance.coords);
};

export const updateText = async (
  key: string,
  text: string,
  font: string,
  colorId: number,
  lineSpacing: number,
): Promise<TextInstance | null> => {
  const textLayerStorage = new TextLayerStorage();
  const existing = await textLayerStorage.get(key);
  if (!existing) return null;

  await ensureFontLoaded();
  const blob = await textToBlob(text, font, colorId, lineSpacing);

  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  await textLayerStorage.save({
    ...existing,
    text,
    font,
    lineSpacing,
    dataUrl,
    colorId,
    timestamp: Date.now(),
  });

  await sendTextLayersToInject();

  console.log("🧑‍🎨 : Text updated", key);

  return {
    key,
    text,
    font,
    lineSpacing,
    coords: existing.coords,
    colorId,
  };
};

export const deleteText = async (
  key: string,
  textInstances: TextInstance[]
): Promise<TextInstance[]> => {
  // Delete from text layer storage
  const textLayerStorage = new TextLayerStorage();
  await textLayerStorage.delete(key);

  // Notify inject side
  await sendTextLayersToInject();

  console.log("🧑‍🎨 : Text deleted", key);
  return textInstances.filter((i) => i.key !== key);
};
