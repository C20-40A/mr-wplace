import Template from "./Template";

/** Overlay interface for minimal compatibility */
interface Overlay {
  handleDisplayStatus(message: string): void;
}

/** 最小化されたTemplateManager - 画像表示機能のみ
 * WPlace Studio用に簡略化
 */
export default class TemplateManager {
  public overlay: Overlay;
  public tileSize: number;
  public drawMult: number;
  public templatesArray: Template[];
  public templatesShouldBeDrawn: boolean;

  constructor(name: string, overlay: Overlay) {
    this.overlay = overlay;
    this.tileSize = 1000;
    this.drawMult = 3;

    this.templatesArray = []; // アクティブなテンプレート
    this.templatesShouldBeDrawn = true;
  }

  /** テンプレート作成（コア機能のみ） */
  async createTemplate(blob: File, coords: number[]): Promise<void> {
    this.overlay.handleDisplayStatus(
      `Creating template at ${coords.join(", ")}...`
    );

    // テンプレート作成
    const template = new Template({
      file: blob,
      coords: coords,
    });

    const { templateTiles } = await template.createTemplateTiles();
    template.chunked = templateTiles;

    // 既存テンプレートをクリア（単一テンプレートのみ対応）
    this.templatesArray = [];
    this.templatesArray.push(template);

    this.overlay.handleDisplayStatus(
      `Template created! Pixels: ${new Intl.NumberFormat().format(
        template.pixelCount
      )}`
    );
  }

  /** タイルに画像描画（メイン機能） */
  async drawTemplateOnTile(
    tileBlob: Blob,
    tileCoords: [number, number]
  ): Promise<Blob> {
    if (!this.templatesShouldBeDrawn || this.templatesArray.length === 0) {
      return tileBlob;
    }

    const drawSize = this.tileSize * this.drawMult;
    const coordStr =
      tileCoords[0].toString().padStart(4, "0") +
      "," +
      tileCoords[1].toString().padStart(4, "0");

    // テンプレートがこのタイルに影響するかチェック
    const template = this.templatesArray[0]; // 単一テンプレート想定
    if (!template?.chunked) return tileBlob;

    const matchingTiles = Object.keys(template.chunked).filter((tile) =>
      tile.startsWith(coordStr)
    );

    if (matchingTiles.length === 0) return tileBlob;

    // Canvas描画処理
    const tileBitmap = await createImageBitmap(tileBlob);
    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext("2d");

    if (!context) throw new Error("Failed to get 2D context");

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, drawSize, drawSize);
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    // テンプレート描画
    for (const tileKey of matchingTiles) {
      const coords = tileKey.split(",");
      const templateBitmap = template.chunked[tileKey];

      context.drawImage(
        templateBitmap,
        Number(coords[2]) * this.drawMult,
        Number(coords[3]) * this.drawMult
      );
    }

    return await canvas.convertToBlob({ type: "image/png" });
  }

  /** テンプレート表示ON/OFF */
  setTemplatesShouldBeDrawn(value: boolean): void {
    this.templatesShouldBeDrawn = value;
  }
}
