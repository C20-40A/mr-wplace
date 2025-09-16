import { Template } from "./Template";

/** 最小化されたTemplateManager - 画像表示機能のみ
 * WPlace Studio用に簡略化
 */
export class TemplateManager {
  public tileSize: number;
  public drawMult: number;
  public templatesArray: Template[];

  constructor() {
    this.tileSize = 1000;
    this.drawMult = 3;

    this.templatesArray = []; // アクティブなテンプレート
  }

  /** テンプレート作成（コア機能のみ） */
  async createTemplate(blob: File, coords: number[]): Promise<void> {
    // テンプレート作成
    const template = new Template({
      file: blob,
      coords: coords,
    });

    const { templateTiles } = await template.createTemplateTiles();
    template.chunked = templateTiles;

    // 複数テンプレート対応: 追加のみ
    this.templatesArray.push(template);
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

    // 全テンプレートから該当タイルを収集
    const allMatchingTiles: Array<{ tileKey: string; template: Template }> = [];

    for (const template of this.templatesArray) {
      if (!template?.chunked) continue;

      const matchingTiles = Object.keys(template.chunked).filter((tile) =>
        tile.startsWith(coordStr)
      );

      for (const tileKey of matchingTiles) {
        allMatchingTiles.push({ tileKey, template });
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
    for (const { tileKey, template } of allMatchingTiles) {
      const coords = tileKey.split(",");
      const templateBitmap = template.chunked?.[tileKey];
      if (!templateBitmap) continue;

      context.drawImage(
        templateBitmap,
        Number(coords[2]) * this.drawMult,
        Number(coords[3]) * this.drawMult
      );
    }

    return await canvas.convertToBlob({ type: "image/png" });
  }

  /** 特定テンプレート削除（複数対応用） */
  removeTemplate(templateToRemove: Template): void {
    this.templatesArray = this.templatesArray.filter(
      (t) => t !== templateToRemove
    );
  }

  /** 全テンプレートクリア */
  clearAllTemplates(): void {
    this.templatesArray = [];
  }
}
