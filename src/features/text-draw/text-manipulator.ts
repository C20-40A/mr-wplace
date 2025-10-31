import { getCurrentPosition } from "../../utils/position";
import { llzToTilePixel } from "../../utils/coordinate";
import { Toast } from "../../components/toast";
import { ensureFontLoaded } from "./font-loader";
import { textToBlob } from "./text-renderer";
import type { TextInstance } from "./ui";
import { GalleryStorage } from "@/features/gallery/storage";
import { sendGalleryImagesToInject } from "@/content";

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

  // Convert blob to dataUrl
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });

  // Save to gallery storage
  const galleryStorage = new GalleryStorage();
  await galleryStorage.save({
    key,
    dataUrl,
    drawPosition: {
      TLX: coords.TLX,
      TLY: coords.TLY,
      PxX: coords.PxX,
      PxY: coords.PxY,
    },
    drawEnabled: true,
    layerOrder: Date.now(),
  });

  // Notify inject side
  await sendGalleryImagesToInject();

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

  // Update gallery storage
  const galleryStorage = new GalleryStorage();
  const existing = await galleryStorage.get(instance.key);

  if (existing) {
    await galleryStorage.save({
      ...existing,
      drawPosition: {
        TLX: instance.coords.TLX,
        TLY: instance.coords.TLY,
        PxX: instance.coords.PxX,
        PxY: instance.coords.PxY,
      },
    });

    // Notify inject side
    await sendGalleryImagesToInject();
  }

  console.log("🧑‍🎨 : Text moved", direction, instance.coords);
};

export const deleteText = async (
  key: string,
  textInstances: TextInstance[]
): Promise<TextInstance[]> => {
  // Delete from gallery storage
  const galleryStorage = new GalleryStorage();
  await galleryStorage.delete(key);

  // Notify inject side
  await sendGalleryImagesToInject();

  console.log("🧑‍🎨 : Text deleted", key);
  return textInstances.filter((i) => i.key !== key);
};
