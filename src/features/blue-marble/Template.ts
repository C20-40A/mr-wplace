import { uint8ToBase64, colorpalette } from "./utils";
import { createTemplateTiles as createTemplateTilesFn } from "./template-functions";

/** テンプレートコンストラクタパラメータ */
interface TemplateParams {
  url?: string;
  file?: File | null;
  coords?: number[] | null;
  chunked?: Record<string, ImageBitmap> | null;
  tileSize?: number;
}

/** テンプレート用カラーパレットエントリ */
interface PaletteEntry {
  count: number;
  enabled: boolean;
}

export default class Template {
  public url: string;
  public file: File | null;
  public coords: number[] | null;
  public chunked: Record<string, ImageBitmap> | null;
  public tileSize: number;
  public pixelCount: number;
  public colorPalette: Record<string, PaletteEntry>;
  public tilePrefixes: Set<string>;
  public allowedColorsSet: Set<string>;

  /** 拡張ピクセルトラッキング機能付きTemplateクラスのコンストラクタ */
  constructor({
    url = "",
    file = null,
    coords = null,
    chunked = null,
    tileSize = 1000,
  }: TemplateParams = {}) {
    this.url = url;
    this.file = file;
    this.coords = coords;
    this.chunked = chunked;
    this.tileSize = tileSize;
    this.pixelCount = 0; // テンプレート内の総ピクセル数
    this.colorPalette = {}; // キー: "r,g,b" -> { count: number, enabled: boolean }
    this.tilePrefixes = new Set(); // このテンプレートが影響する"xxxx,yyyy"タイルのセット

    // サイトパレットから許可色セットを構築（特別な透明エントリを名前で除外）
    // "transparent"を除くWplaceパレット色のSetを作成
    const allowed = Array.isArray(colorpalette) ? colorpalette : [];
    this.allowedColorsSet = new Set(
      allowed
        .filter(
          (color) =>
            (color?.name || "").toLowerCase() !== "transparent" &&
            Array.isArray(color?.rgb)
        )
        .map((color) => `${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`)
    );

    // Ensure template #deface marker is treated as allowed (maps to Transparent color)
    const defaceKey = "222,250,206";
    this.allowedColorsSet.add(defaceKey);

    const keyOther = "other";
    this.allowedColorsSet.add(keyOther); // Special "other" key for non-palette colors



    console.log("Allowed colors for template:", this.allowedColorsSet);
  }

  /** タイルチャンク作成（関数型実装へのラッパー）
   *
   * @returns タイル座標でグループ化されたテンプレートビットマップとバッファのコレクション
   */
  async createTemplateTiles(): Promise<{
    templateTiles: Record<string, ImageBitmap>;
    templateTilesBuffers: Record<string, string>;
  }> {
    console.log("Template coordinates:", this.coords);

    if (!this.file || !this.coords) {
      throw new Error("Template file and coordinates are required");
    }

    // 関数型実装を呼び出し
    const result = await createTemplateTilesFn({
      file: this.file,
      coords: this.coords,
      tileSize: this.tileSize,
      allowedColorsSet: this.allowedColorsSet,
    });

    // インスタンス状態を更新（既存の動作を保持）
    this.pixelCount = result.pixelCount;
    this.colorPalette = result.colorPalette;
    this.tilePrefixes = result.tilePrefixes;

    return {
      templateTiles: result.templateTiles,
      templateTilesBuffers: result.templateTilesBuffers,
    };
  }
}
