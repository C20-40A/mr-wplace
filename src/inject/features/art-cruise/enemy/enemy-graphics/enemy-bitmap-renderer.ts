import { DYNAMIC_ENEMY_ALPHA_THRESHOLD } from "../../constants";

const ENEMY_EFFECT_PADDING_PX = 3;
const ENEMY_SHADOW_OFFSET_PX = 2;

export const createEnemyBitmap = (imageData: ImageData): Promise<ImageBitmap> =>
  createImageBitmap(createOutlinedEnemyImageData(imageData));

const createOutlinedEnemyImageData = (source: ImageData) => {
  const padding = ENEMY_EFFECT_PADDING_PX;
  const width = source.width + padding * 2;
  const height = source.height + padding * 2;
  const result = new ImageData(width, height);
  const sourceAlpha = source.data;
  const target = result.data;

  const hasSourceAlpha = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= source.width || y >= source.height)
      return false;
    return (
      sourceAlpha[(y * source.width + x) * 4 + 3] >
      DYNAMIC_ENEMY_ALPHA_THRESHOLD
    );
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceX = x - padding;
      const sourceY = y - padding;
      const offset = (y * width + x) * 4;

      if (
        hasSourceAlpha(
          sourceX - ENEMY_SHADOW_OFFSET_PX,
          sourceY + ENEMY_SHADOW_OFFSET_PX,
        )
      ) {
        target[offset] = 0;
        target[offset + 1] = 0;
        target[offset + 2] = 0;
        target[offset + 3] = 190;
      }

      if (
        hasSourceAlpha(sourceX, sourceY - 1) ||
        hasSourceAlpha(sourceX - 1, sourceY) ||
        hasSourceAlpha(sourceX + 1, sourceY) ||
        hasSourceAlpha(sourceX, sourceY + 1) ||
        hasSourceAlpha(sourceX - 1, sourceY - 1) ||
        hasSourceAlpha(sourceX + 1, sourceY - 1) ||
        hasSourceAlpha(sourceX - 1, sourceY + 1) ||
        hasSourceAlpha(sourceX + 1, sourceY + 1)
      ) {
        target[offset] = 255;
        target[offset + 1] = 255;
        target[offset + 2] = 255;
        target[offset + 3] = 255;
      }

      if (!hasSourceAlpha(sourceX, sourceY)) continue;

      const sourceOffset = (sourceY * source.width + sourceX) * 4;
      target[offset] = source.data[sourceOffset];
      target[offset + 1] = source.data[sourceOffset + 1];
      target[offset + 2] = source.data[sourceOffset + 2];
      target[offset + 3] = source.data[sourceOffset + 3];
    }
  }

  return result;
};
