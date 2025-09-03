import { OverlayMode } from "./ui";
import { Toolbar } from "../../components/toolbar";
import { llzToTilePixel } from "../../utils/coordinate";

export class TileOverlay {
  private readonly TILE_SIZE = 1000;
  private mode = OverlayMode.ON;
  private button: HTMLButtonElement | null = null;
  private toolbar: Toolbar;
  private drawingImage: any = null;
  private drawingCoords: any = null;
  private drawingTileRange: any = null;

  constructor(toolbar: Toolbar) {
    this.toolbar = toolbar;
    this.init();
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.observeAndInit()
      );
    } else {
      this.observeAndInit();
    }
  }

  private observeAndInit(): void {
    this.setupTileProcessing();
    this.startUIObserver();
  }

  private startUIObserver(): void {
    const ensureUI = () => {
      if (!this.button) {
        this.createButton();
      }
    };

    const observer = new MutationObserver(() => {
      ensureUI();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ensureUI();
  }

  private createButton(): void {
    this.button = this.toolbar.addButton({
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
          <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>
        </svg>
      `,
      title: `Toggle Overlay (${this.mode})`,
      onClick: () => this.cycleMode()
    });
    this.updateButtonState();
  }

  private cycleMode(): void {
    switch (this.mode) {
      case OverlayMode.ON:
        this.mode = OverlayMode.TRANSPARENT;
        break;
      case OverlayMode.TRANSPARENT:
        this.mode = OverlayMode.OFF;
        break;
      case OverlayMode.OFF:
        this.mode = OverlayMode.ON;
        break;
    }
    this.updateButtonState();
    this.setMode(this.mode);
  }

  private updateButtonState(): void {
    if (!this.button) return;

    switch (this.mode) {
      case OverlayMode.ON:
        this.button.classList.remove('opacity-50');
        this.button.title = 'Toggle Overlay (ON)';
        break;
      case OverlayMode.TRANSPARENT:
        this.button.classList.remove('opacity-50');
        this.button.style.opacity = '0.7';
        this.button.title = 'Toggle Overlay (TRANSPARENT)';
        break;
      case OverlayMode.OFF:
        this.button.classList.add('opacity-50');
        this.button.style.opacity = '';
        this.button.title = 'Toggle Overlay (OFF)';
        break;
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

  setMode(mode: OverlayMode): void {
    this.mode = mode;
    console.log(`Tile overlay: ${mode}`);
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
    context.drawImage(tileBitmap, 0, 0);

    // Draw image
    if (this.drawingImage && this.drawingCoords) {
      try {
        const img = new Image();
        img.src = this.drawingImage.dataUrl;
        await img.decode();
        
        // Calculate affected tile range on first tile processing
        if (!this.drawingTileRange) {
          this.calculateTileRange(img.naturalWidth, img.naturalHeight);
        }
        
        // Calculate image portion for this specific tile
        const imagePortion = this.getImagePortionForTile(tileX, tileY, img.naturalWidth, img.naturalHeight);
        
        if (imagePortion) {
          if (this.mode === OverlayMode.TRANSPARENT) {
            context.globalAlpha = 0.5;
          }
          
          // Draw specific portion of image on this tile
          context.drawImage(
            img,
            imagePortion.srcX, imagePortion.srcY, imagePortion.srcWidth, imagePortion.srcHeight,
            imagePortion.dstX, imagePortion.dstY, imagePortion.dstWidth, imagePortion.dstHeight
          );
          context.globalAlpha = 1.0;
          
          console.log(`✅ Drew image portion on tile ${tileX},${tileY}`);
        }
      } catch (error) {
        console.error("Failed to draw image:", error);
      }
    }

    return await canvas.convertToBlob({ type: "image/png" });
  }

  calculateTileRange(imageWidth: number, imageHeight: number): void {
    if (!this.drawingCoords) return;
    
    // Calculate absolute coordinates
    const imgStartAbsX = this.drawingCoords.TLX * this.TILE_SIZE + this.drawingCoords.PxX;
    const imgStartAbsY = this.drawingCoords.TLY * this.TILE_SIZE + this.drawingCoords.PxY;
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
      imageHeight
    };
    
    console.log("🗺️ Calculated tile range:", this.drawingTileRange);
    console.log(`🗺️ Tiles affected: ${minTileX}-${maxTileX}, ${minTileY}-${maxTileY}`);
  }

  getImagePortionForTile(tileX: number, tileY: number, imageWidth: number, imageHeight: number): any {
    if (!this.drawingCoords || !this.drawingTileRange) return null;
    
    // Check if this tile is in drawing range
    if (tileX < this.drawingTileRange.minTileX || tileX > this.drawingTileRange.maxTileX ||
        tileY < this.drawingTileRange.minTileY || tileY > this.drawingTileRange.maxTileY) {
      return null;
    }
    
    // Calculate absolute coordinates
    const imgStartX = this.drawingCoords.TLX * this.TILE_SIZE + this.drawingCoords.PxX;
    const imgStartY = this.drawingCoords.TLY * this.TILE_SIZE + this.drawingCoords.PxY;
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
      // Source coordinates in image
      srcX: intersectStartX - imgStartX,
      srcY: intersectStartY - imgStartY,
      srcWidth: intersectEndX - intersectStartX,
      srcHeight: intersectEndY - intersectStartY,
      // Destination coordinates in tile
      dstX: intersectStartX - tileStartX,
      dstY: intersectStartY - tileStartY,
      dstWidth: intersectEndX - intersectStartX,
      dstHeight: intersectEndY - intersectStartY
    };
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // Return original tile if off
    if (this.mode === OverlayMode.OFF) {
      return tileBlob;
    }

    // Check for image drawing
    if (this.drawingImage && this.drawingCoords) {
      // First time: calculate range with any tile in drawing coords
      if (!this.drawingTileRange && (tileX === this.drawingCoords.TLX || tileY === this.drawingCoords.TLY)) {
        console.log(`⚡ First tile processing for image drawing on ${tileX},${tileY}`);
        return this.drawImageOnTile(tileBlob, tileX, tileY);
      }
      // After range calculated: check all tiles in range
      if (this.drawingTileRange) {
        console.log(`🔍 Checking tile ${tileX},${tileY} against range:`, this.drawingTileRange);
        if (tileX >= this.drawingTileRange.minTileX && tileX <= this.drawingTileRange.maxTileX &&
            tileY >= this.drawingTileRange.minTileY && tileY <= this.drawingTileRange.maxTileY) {
          console.log(`✅ Tile ${tileX},${tileY} is in range, drawing image`);
          return this.drawImageOnTile(tileBlob, tileX, tileY);
        } else {
          console.log(`❌ Tile ${tileX},${tileY} is outside range`);
        }
      }
    } else {
      console.log(`🔍 No image drawing: drawingImage=${!!this.drawingImage}, drawingCoords=${!!this.drawingCoords}`);
    }

    // Original pixel drawing (520,218 only)
    if (tileX !== 520 || tileY !== 218) {
      return tileBlob;
    }

    console.log(`Processing tile ${tileX},${tileY} in ${this.mode} mode`);

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

    // Draw red pixel with appropriate opacity
    if (this.mode === OverlayMode.TRANSPARENT) {
      context.globalAlpha = 0.5;
    }
    context.fillStyle = "red";
    context.fillRect(811, 118, 1, 1);
    context.globalAlpha = 1.0; // Reset

    console.log(`Drew red pixel with ${this.mode} mode`);

    // Return modified blob
    return await canvas.convertToBlob({ type: "image/png" });
  }
}
