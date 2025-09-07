import { llzToTilePixel } from "../../utils/coordinate";

export class TileOverlay {
  private readonly TILE_SIZE = 1000;
  private drawingImage: any = null;
  private drawingCoords: any = null;
  private drawingTileRange: any = null;
  private drawMult = 3; // Draw at 3x for better quality

  constructor() {
    this.init();
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.setupTileProcessing()
      );
    } else {
      this.setupTileProcessing();
    }
  }

  private setupTileProcessing(): void {
    window.addEventListener("message", async (event) => {
      if (event.data.source === "wplace-studio-tile") {
        const { blobID, tileBlob, tileX, tileY } = event.data;

        try {
          const processedBlob = await this.drawPixelOnTile(
            tileBlob,
            tileX,
            tileY
          );

          window.postMessage(
            {
              source: "wplace-studio-processed",
              blobID: blobID,
              processedBlob: processedBlob,
            },
            "*"
          );
        } catch (error) {
          console.error("Failed to process tile:", error);
        }
      }
    });

    console.log("Tile processing listener setup complete");
  }

  drawImageAt(lat: number, lng: number, imageItem: any): void {
    console.log("🖼️ Drawing image at:", lat, lng);

    // Convert coordinates
    const coords = llzToTilePixel(lat, lng);
    console.log("Tile coords:", coords);

    this.drawingImage = imageItem;
    this.drawingCoords = coords;

    // Calculate affected tile range (will be set after image size known)
    this.drawingTileRange = null;

    console.log("✅ Image drawing setup complete");
  }

  async drawImageOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    console.log(`🎨 Drawing image on tile ${tileX},${tileY}`);

    const canvas = new OffscreenCanvas(this.TILE_SIZE, this.TILE_SIZE);
    const context = canvas.getContext("2d");

    if (!context) {
      console.warn("Failed to get canvas context");
      return tileBlob;
    }

    // Draw original tile
    const tileBitmap = await createImageBitmap(tileBlob);
    context.imageSmoothingEnabled = false;
    context.drawImage(tileBitmap, 0, 0, this.TILE_SIZE, this.TILE_SIZE);

    // Draw image
    if (!this.drawingImage || !this.drawingCoords) {
      console.warn("No drawing image or coordinates set");
      return tileBlob;
    }

    try {
      const img = new Image();
      img.src = this.drawingImage.dataUrl;
      await img.decode();

      // Calculate affected tile range on first tile processing
      if (!this.drawingTileRange) {
        this.calculateTileRange(img.naturalWidth, img.naturalHeight);
      }

      // Calculate image portion for this specific tile
      const imagePortion = this.getImagePortionForTile(
        tileX,
        tileY,
        img.naturalWidth,
        img.naturalHeight
      );

      if (!imagePortion) {
        console.log(`❌ No image portion for tile ${tileX},${tileY}`);
        return tileBlob;
      }

      const scaledWidth = imagePortion.srcWidth * this.drawMult;
      const scaledHeight = imagePortion.srcHeight * this.drawMult;

      // 1. 一時的なキャンバスに元の画像を拡大して描画
      const tempCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
      const tempContext = tempCanvas.getContext("2d");
      if (!tempContext) throw new Error("Failed to get temp canvas context");
      // ピクセル補間をオフ
      tempContext.imageSmoothingEnabled = false;

      // 拡大して描画（元ピクセルが3x3ブロックになる）
      tempContext.drawImage(
        img,
        imagePortion.srcX,
        imagePortion.srcY,
        imagePortion.srcWidth,
        imagePortion.srcHeight,
        0,
        0,
        scaledWidth,
        scaledHeight
      );

      // 2. 一時キャンバスから全ピクセルデータを取得
      const imageData = tempContext.getImageData(
        0,
        0,
        scaledWidth,
        scaledHeight
      );

      // 3. ピクセルデータの編集(中央以外透明化)
      for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
          // 中心ピクセル（x%3==1 && y%3==1）以外を透過させる
          if (x % this.drawMult !== 1 || y % this.drawMult !== 1) {
            const pixelIndex = (y * imageData.width + x) * 4;
            imageData.data[pixelIndex + 3] = 0; // Make transparent
          }
        }
      }

      // 3. 取得したピクセルデータからImageBitmapを作成
      const pixelBitmap = await createImageBitmap(imageData);

      // 4. 最終キャンバスに描画
      context.imageSmoothingEnabled = false;
      // context.scale(0.5, 0.5);
      context.drawImage(
        pixelBitmap,
        0,
        0,
        scaledWidth,
        scaledHeight,
        imagePortion.dstX,
        imagePortion.dstY,
        imagePortion.dstWidth,
        imagePortion.dstHeight
      );
      // context.scale(3, 3);

      context.globalAlpha = 1.0;
      console.log(`✅ Drew image portion on tile ${tileX},${tileY}`);
    } catch (error) {
      console.error("Failed to draw image:", error);
    }

    return await canvas.convertToBlob({ type: "image/png" });
  }

  calculateTileRange(imageWidth: number, imageHeight: number): void {
    if (!this.drawingCoords) return;

    // Calculate absolute coordinates (original size, no multiplier)
    const imgStartAbsX =
      this.drawingCoords.TLX * this.TILE_SIZE + this.drawingCoords.PxX;
    const imgStartAbsY =
      this.drawingCoords.TLY * this.TILE_SIZE + this.drawingCoords.PxY;
    const imgEndAbsX = imgStartAbsX + imageWidth;
    const imgEndAbsY = imgStartAbsY + imageHeight;

    // Calculate affected tile range
    const minTileX = this.drawingCoords.TLX;
    const minTileY = this.drawingCoords.TLY;
    const maxTileX = Math.floor((imgEndAbsX - 1) / this.TILE_SIZE);
    const maxTileY = Math.floor((imgEndAbsY - 1) / this.TILE_SIZE);

    this.drawingTileRange = {
      minTileX,
      maxTileX,
      minTileY,
      maxTileY,
      imageWidth,
      imageHeight,
    };

    console.log("🗺️ Calculated tile range:", this.drawingTileRange);
    console.log(
      `🗺️ Tiles affected: ${minTileX}-${maxTileX}, ${minTileY}-${maxTileY}`
    );
  }

  getImagePortionForTile(
    tileX: number,
    tileY: number,
    imageWidth: number,
    imageHeight: number
  ) {
    if (!this.drawingCoords || !this.drawingTileRange) return null;

    // Check if this tile is in drawing range
    if (
      tileX < this.drawingTileRange.minTileX ||
      tileX > this.drawingTileRange.maxTileX ||
      tileY < this.drawingTileRange.minTileY ||
      tileY > this.drawingTileRange.maxTileY
    ) {
      return null;
    }

    // Calculate absolute coordinates (original size)
    const imgStartX =
      this.drawingCoords.TLX * this.TILE_SIZE + this.drawingCoords.PxX;
    const imgStartY =
      this.drawingCoords.TLY * this.TILE_SIZE + this.drawingCoords.PxY;
    const imgEndX = imgStartX + imageWidth;
    const imgEndY = imgStartY + imageHeight;

    const tileStartX = tileX * this.TILE_SIZE;
    const tileStartY = tileY * this.TILE_SIZE;
    const tileEndX = tileStartX + this.TILE_SIZE;
    const tileEndY = tileStartY + this.TILE_SIZE;

    // Calculate intersection
    const intersectStartX = Math.max(imgStartX, tileStartX);
    const intersectStartY = Math.max(imgStartY, tileStartY);
    const intersectEndX = Math.min(imgEndX, tileEndX);
    const intersectEndY = Math.min(imgEndY, tileEndY);

    if (intersectStartX >= intersectEndX || intersectStartY >= intersectEndY) {
      return null; // No intersection
    }

    return {
      // Source coordinates in image (original size)
      srcX: intersectStartX - imgStartX,
      srcY: intersectStartY - imgStartY,
      srcWidth: intersectEndX - intersectStartX,
      srcHeight: intersectEndY - intersectStartY,
      // Destination coordinates in tile
      dstX: intersectStartX - tileStartX,
      dstY: intersectStartY - tileStartY,
      dstWidth: intersectEndX - intersectStartX,
      dstHeight: intersectEndY - intersectStartY,
    };
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // Check for image drawing
    if (this.drawingImage && this.drawingCoords) {
      // First time: calculate range with any tile in drawing coords
      if (
        !this.drawingTileRange &&
        (tileX === this.drawingCoords.TLX || tileY === this.drawingCoords.TLY)
      ) {
        console.log(
          `⚡ First tile processing for image drawing on ${tileX},${tileY}`
        );
        return this.drawImageOnTile(tileBlob, tileX, tileY);
      }
      // After range calculated: check all tiles in range
      if (this.drawingTileRange) {
        console.log(
          `🔍 Checking tile ${tileX},${tileY} against range:`,
          this.drawingTileRange
        );
        if (
          tileX >= this.drawingTileRange.minTileX &&
          tileX <= this.drawingTileRange.maxTileX &&
          tileY >= this.drawingTileRange.minTileY &&
          tileY <= this.drawingTileRange.maxTileY
        ) {
          console.log(`✅ Tile ${tileX},${tileY} is in range, drawing image`);
          return this.drawImageOnTile(tileBlob, tileX, tileY);
        } else {
          console.log(`❌ Tile ${tileX},${tileY} is outside range`);
        }
      }
    } else {
      console.log(
        `🔍 No image drawing: drawingImage=${!!this
          .drawingImage}, drawingCoords=${!!this.drawingCoords}`
      );
    }

    // Return original tile if no processing needed
    return tileBlob;
  }
}
