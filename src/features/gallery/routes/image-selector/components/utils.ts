import type { ImageItem } from "../../list/components";

/**
 * GalleryItemをImageItemに変換
 */
export const convertGalleryItemToImageItem = (item: any): ImageItem => {
  // timestampが無効な場合は現在時刻を使用
  const timestamp = item.timestamp && !isNaN(item.timestamp)
    ? item.timestamp
    : Date.now();

  return {
    key: item.key,
    dataUrl: item.dataUrl,
    thumbnail: item.thumbnail,
    title: item.title,
    createdAt: new Date(timestamp).toISOString(),
    drawEnabled: item.drawEnabled,
    hasDrawPosition: !!item.drawPosition,
  };
};
