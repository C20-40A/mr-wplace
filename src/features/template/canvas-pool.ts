/**
 * Canvas Pool - Reuse OffscreenCanvas instances to reduce allocation overhead
 * Purpose: Prevent excessive Canvas creation in drawTemplateOnTile() which generates 3+N canvases per call
 */
export class CanvasPool {
  private static pools = new Map<string, OffscreenCanvas[]>();
  private static readonly MAX_POOL_SIZE = 5;

  /**
   * Acquire canvas from pool or create new one
   * @param width Canvas width
   * @param height Canvas height
   * @returns Clean OffscreenCanvas ready for use
   */
  static acquire(width: number, height: number): OffscreenCanvas {
    const key = `${width},${height}`;
    const pool = this.pools.get(key) || [];

    const canvas = pool.pop() || new OffscreenCanvas(width, height);

    // Clear canvas state for reuse
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      ctx.resetTransform();
    }

    return canvas;
  }

  /**
   * Release canvas back to pool for reuse
   * @param canvas Canvas to return to pool
   */
  static release(canvas: OffscreenCanvas): void {
    const key = `${canvas.width},${canvas.height}`;
    const pool = this.pools.get(key) || [];

    // Prevent memory leak by limiting pool size
    if (pool.length < this.MAX_POOL_SIZE) {
      pool.push(canvas);
      this.pools.set(key, pool);
    }
  }
}
