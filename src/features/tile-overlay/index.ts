export class TileOverlay {
  private readonly TILE_SIZE = 1000;

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // Only process tile 1803,802
    if (tileX !== 1803 || tileY !== 802) {
      return tileBlob;
    }

    console.log(`Processing tile ${tileX},${tileY}`);

    // Create canvas for drawing
    const canvas = new OffscreenCanvas(this.TILE_SIZE, this.TILE_SIZE);
    const context = canvas.getContext("2d");

    if (!context) {
      console.warn("Failed to get canvas context");
      return tileBlob;
    }

    // Draw original tile
    const tileBitmap = await createImageBitmap(tileBlob);
    context.drawImage(tileBitmap, 0, 0);

    // Draw red pixel at (345, 497)
    context.fillStyle = "red";
    context.fillRect(345, 497, 1, 1);

    console.log("Drew red pixel at (345, 497)");

    // Return modified blob
    return await canvas.convertToBlob({ type: "image/png" });
  }
}
