import { Template } from "./Template";
import { ColorFilterManager } from "../../utils/color-filter-manager";

interface TemplateInstance {
  template: Template;
  imageKey: string;
  drawEnabled: boolean;
}

/** 最小化されたTemplateManager - 画像表示機能のみ
 */
export class TemplateManager {
  public tileSize: number;
  public drawMult: number;
  public templatesArray: TemplateInstance[];

  constructor() {
    this.tileSize = 1000;
    this.drawMult = 3;

    this.templatesArray = []; // アクティブなテンプレート
  }

  /** テンプレート作成（コア機能のみ） */
  async createTemplate(
    blob: File,
    coords: number[],
    imageKey: string
  ): Promise<void> {
    // 既存の同じimageKeyのTemplateInstanceを削除（重複防止）
    this.removeTemplateByKey(imageKey);

    // テンプレート作成
    const template = new Template({
      file: blob,
      coords: coords,
    });

    const { templateTiles } = await template.createTemplateTiles();
    template.chunked = templateTiles;

    // TemplateInstanceとして追加
    this.templatesArray.push({
      template,
      imageKey,
      drawEnabled: true,
    });
  }

  /** タイルに画像描画（メイン機能） */
  async drawTemplateOnTile(
    tileBlob: Blob,
    tileCoords: [number, number]
  ): Promise<Blob> {
    if (this.templatesArray.length === 0) return tileBlob;

    const drawSize = this.tileSize * this.drawMult;
    const coordStr =
      tileCoords[0].toString().padStart(4, "0") +
      "," +
      tileCoords[1].toString().padStart(4, "0");

    // 全テンプレートから該当タイル（有効のみ）を収集
    const allMatchingTiles: Array<{ tileKey: string; template: Template }> = [];

    for (const templateInstance of this.templatesArray) {
      if (
        !templateInstance?.drawEnabled ||
        !templateInstance?.template?.chunked
      )
        continue;

      const matchingTiles = Object.keys(
        templateInstance.template.chunked
      ).filter((tile) => tile.startsWith(coordStr));

      for (const tileKey of matchingTiles) {
        allMatchingTiles.push({ tileKey, template: templateInstance.template });
      }
    }

    if (allMatchingTiles.length === 0) return tileBlob;

    // Canvas描画処理
    const tileBitmap = await createImageBitmap(tileBlob);
    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext("2d");

    if (!context) throw new Error("Failed to get 2D context");

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, drawSize, drawSize);
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    // 全テンプレート描画（配列順序で後勝ち）
    const colorFilter = (window as any)
      .colorFilterManager as ColorFilterManager;

    for (const { tileKey, template } of allMatchingTiles) {
      const coords = tileKey.split(",");
      const templateBitmap = template.chunked?.[tileKey];
      if (!templateBitmap) continue;

      // 色フィルタ適用
      let filteredBitmap = templateBitmap;
      if (colorFilter?.isFilterActive()) {
        const filtered = colorFilter.applyColorFilter(templateBitmap);
        if (filtered) filteredBitmap = filtered;
      }

      context.drawImage(
        filteredBitmap,
        Number(coords[2]) * this.drawMult,
        Number(coords[3]) * this.drawMult
      );
    }

    return await canvas.convertToBlob({ type: "image/png" });
  }

  /** 特定テンプレート削除（imageKey指定） */
  removeTemplateByKey(imageKey: string): void {
    this.templatesArray = this.templatesArray.filter(
      (instance) => instance.imageKey !== imageKey
    );
  }

  /** 描画状態切り替え */
  toggleDrawEnabled(imageKey: string): boolean {
    const instance = this.templatesArray.find((i) => i.imageKey === imageKey);
    if (!instance) return false;

    instance.drawEnabled = !instance.drawEnabled;
    return instance.drawEnabled;
  }

  /** 全テンプレートクリア */
  clearAllTemplates(): void {
    this.templatesArray = [];
  }

  /** 特定タイル座標での描画判定 */
  isDrawingOnTile(tileX: number, tileY: number): boolean {
    for (const instance of this.templatesArray) {
      if (!instance.drawEnabled || !instance.template?.coords) continue;

      const [templateTileX, templateTileY] = instance.template.coords;
      if (templateTileX === tileX && templateTileY === tileY) {
        return true;
      }
    }
    return false;
  }





}
