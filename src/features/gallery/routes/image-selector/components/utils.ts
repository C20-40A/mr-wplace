import type { ImageItem } from "../../list/components";

/**
 * GalleryItemをImageItemに変換
 */
export const convertGalleryItemToImageItem = (item: any): ImageItem => {
  return {
    key: item.key,
    dataUrl: item.dataUrl,
    title: item.title,
    createdAt: new Date(item.timestamp).toISOString(),
    drawEnabled: item.drawEnabled,
    hasDrawPosition: !!item.drawPosition,
  };
};
