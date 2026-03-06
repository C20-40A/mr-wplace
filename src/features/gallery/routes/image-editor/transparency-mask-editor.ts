type TransparencyMaskApplyResult = "applied" | "size_mismatch" | "no_mask";

export class TransparencyMaskEditor {
  private committedMask: Uint8Array | null = null;
  private workingMask: Uint8Array | null = null;
  private maskWidth = 0;
  private maskHeight = 0;
  private boundaryAdjust = 0;
  private previewCanvas: HTMLCanvasElement | null = null;
  private previewHandler?: (canvas: HTMLCanvasElement) => void;

  setPreviewHandler(handler?: (canvas: HTMLCanvasElement) => void): void {
    this.previewHandler = handler;
  }

  setBoundaryAdjust(value: number): void {
    this.boundaryAdjust = value;
  }

  handleCanvasClick(
    sourceCanvas: HTMLCanvasElement | null,
    x: number,
    y: number
  ): void {
    if (!sourceCanvas) return;

    const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    if (!width || !height) return;
    if (x < 0 || y < 0 || x >= width || y >= height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const seedIndex = (y * width + x) * 4;
    if (imageData.data[seedIndex + 3] === 0) return;

    this.ensureWorkingMask(width, height);
    if (!this.workingMask) return;

    const region = this.computeFloodFillRegion(imageData, x, y);
    const adjustedRegion = this.expandOrShrinkRegion(
      region,
      width,
      height,
      this.boundaryAdjust
    );

    for (let i = 0; i < adjustedRegion.length; i++) {
      if (adjustedRegion[i]) this.workingMask[i] = 1;
    }

    this.updatePreview(imageData, this.workingMask);
  }

  applyPendingSelection(): void {
    if (this.workingMask) {
      this.committedMask = new Uint8Array(this.workingMask);
    } else {
      this.committedMask = null;
      this.maskWidth = 0;
      this.maskHeight = 0;
    }

    this.workingMask = null;
    this.previewCanvas = null;
  }

  resetPreview(baseCanvas?: HTMLCanvasElement | null): void {
    this.workingMask = null;
    this.previewCanvas = null;
    if (baseCanvas) this.previewHandler?.(baseCanvas);
  }

  clear(): void {
    this.committedMask = null;
    this.workingMask = null;
    this.maskWidth = 0;
    this.maskHeight = 0;
    this.boundaryAdjust = 0;
    this.previewCanvas = null;
  }

  applyCommittedMaskToCanvas(
    canvas: HTMLCanvasElement
  ): TransparencyMaskApplyResult {
    if (!this.committedMask) return "no_mask";
    if (canvas.width !== this.maskWidth || canvas.height !== this.maskHeight) {
      return "size_mismatch";
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "no_mask";

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.applyMaskToImageData(imageData, this.committedMask);
    ctx.putImageData(imageData, 0, 0);
    return "applied";
  }

  private ensureWorkingMask(width: number, height: number): void {
    if (
      !this.workingMask ||
      this.maskWidth !== width ||
      this.maskHeight !== height
    ) {
      this.maskWidth = width;
      this.maskHeight = height;
      this.workingMask = new Uint8Array(width * height);
      if (this.committedMask) this.workingMask.set(this.committedMask);
    }
  }

  private computeFloodFillRegion(
    imageData: ImageData,
    startX: number,
    startY: number
  ): Uint8Array {
    const { width, height, data } = imageData;
    const region = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);

    const startIndex = startY * width + startX;
    const baseOffset = startIndex * 4;
    const baseR = data[baseOffset];
    const baseG = data[baseOffset + 1];
    const baseB = data[baseOffset + 2];
    const baseA = data[baseOffset + 3];

    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    queue[tail++] = startIndex;
    visited[startIndex] = 1;

    while (head < tail) {
      const idx = queue[head++];
      const offset = idx * 4;

      if (
        data[offset] !== baseR ||
        data[offset + 1] !== baseG ||
        data[offset + 2] !== baseB ||
        data[offset + 3] !== baseA
      ) {
        continue;
      }

      region[idx] = 1;

      const x = idx % width;
      const y = Math.floor(idx / width);

      if (x > 0) {
        const left = idx - 1;
        if (!visited[left]) {
          visited[left] = 1;
          queue[tail++] = left;
        }
      }
      if (x + 1 < width) {
        const right = idx + 1;
        if (!visited[right]) {
          visited[right] = 1;
          queue[tail++] = right;
        }
      }
      if (y > 0) {
        const up = idx - width;
        if (!visited[up]) {
          visited[up] = 1;
          queue[tail++] = up;
        }
      }
      if (y + 1 < height) {
        const down = idx + width;
        if (!visited[down]) {
          visited[down] = 1;
          queue[tail++] = down;
        }
      }
    }

    return region;
  }

  private expandOrShrinkRegion(
    region: Uint8Array,
    width: number,
    height: number,
    adjust: number
  ): Uint8Array {
    if (adjust === 0) return region;

    const steps = Math.abs(adjust);
    let current: Uint8Array<ArrayBufferLike> = region;
    let next: Uint8Array<ArrayBufferLike> = new Uint8Array(width * height);

    for (let step = 0; step < steps; step++) {
      next.fill(0);
      if (adjust > 0) {
        for (let y = 0; y < height; y++) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x++) {
            const idx = rowOffset + x;
            if (!current[idx]) continue;
            next[idx] = 1;
            if (x > 0) next[idx - 1] = 1;
            if (x + 1 < width) next[idx + 1] = 1;
            if (y > 0) next[idx - width] = 1;
            if (y + 1 < height) next[idx + width] = 1;
          }
        }
      } else {
        for (let y = 0; y < height; y++) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x++) {
            const idx = rowOffset + x;
            if (!current[idx]) continue;
            const left = x === 0 || current[idx - 1];
            const right = x + 1 === width || current[idx + 1];
            const up = y === 0 || current[idx - width];
            const down = y + 1 === height || current[idx + width];
            if (left && right && up && down) next[idx] = 1;
          }
        }
      }

      const swap = current;
      current = next;
      next = swap;
    }

    return current;
  }

  private updatePreview(baseImageData: ImageData, mask: Uint8Array): void {
    if (!this.previewHandler) return;

    const previewData = new ImageData(
      new Uint8ClampedArray(baseImageData.data),
      baseImageData.width,
      baseImageData.height
    );
    this.applyMaskToImageData(previewData, mask);

    if (!this.previewCanvas) {
      this.previewCanvas = document.createElement("canvas");
    }

    this.previewCanvas.width = previewData.width;
    this.previewCanvas.height = previewData.height;
    const ctx = this.previewCanvas.getContext("2d");
    if (!ctx) return;

    ctx.putImageData(previewData, 0, 0);
    this.previewHandler(this.previewCanvas);
  }

  private applyMaskToImageData(imageData: ImageData, mask: Uint8Array): void {
    const data = imageData.data;
    const len = Math.min(mask.length, data.length / 4);
    for (let i = 0; i < len; i++) {
      if (mask[i]) data[i * 4 + 3] = 0;
    }
  }
}
