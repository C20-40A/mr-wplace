import { uint8ToBase64, colorpalette } from "./utils";
import { createTemplateTiles as createTemplateTilesFn } from "./template-functions";

/** テンプレートコンストラクタパラメータ */
interface TemplateParams {
  displayName?: string;
  sortID?: number;
  authorID?: string;
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

/** RGB色メタ情報 */
interface RgbMeta {
  id: number | string;
  premium: boolean;
  name: string;
}

export default class Template {
  public displayName: string;
  public sortID: number;
  public authorID: string;
  public url: string;
  public file: File | null;
  public coords: number[] | null;
  public chunked: Record<string, ImageBitmap> | null;
  public tileSize: number;
  public pixelCount: number;
  public requiredPixelCount: number;
  public defacePixelCount: number;
  public colorPalette: Record<string, PaletteEntry>;
  public tilePrefixes: Set<string>;
  public storageKey: string | null;
  public allowedColorsSet: Set<string>;
  public rgbToMeta: Map<string, RgbMeta>;

  /** 拡張ピクセルトラッキング機能付きTemplateクラスのコンストラクタ */
  constructor({
    displayName = "My template",
    sortID = 0,
    authorID = "",
    url = "",
    file = null,
    coords = null,
    chunked = null,
    tileSize = 1000,
  }: TemplateParams = {}) {
    this.displayName = displayName;
    this.sortID = sortID;
    this.authorID = authorID;
    this.url = url;
    this.file = file;
    this.coords = coords;
    this.chunked = chunked;
    this.tileSize = tileSize;
    this.pixelCount = 0; // テンプレート内の総ピクセル数
    this.requiredPixelCount = 0; // 非透明・非#defaceピクセルの総数
    this.defacePixelCount = 0; // #defaceピクセル数（ゲーム内透明色を表す）
    this.colorPalette = {}; // キー: "r,g,b" -> { count: number, enabled: boolean }
    this.tilePrefixes = new Set(); // このテンプレートが影響する"xxxx,yyyy"タイルのセット
    this.storageKey = null; // templatesJSON内で設定を永続化するためのキー

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

    // Map rgb-> {id, premium}
    this.rgbToMeta = new Map(
      allowed
        .filter((color) => Array.isArray(color?.rgb))
        .map((color) => [
          `${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`,
          { id: color.id, premium: !!color.premium, name: color.name },
        ])
    );

    // Map #deface to Transparent meta for UI naming and ID continuity
    try {
      const transparent = allowed.find(
        (color) => (color?.name || "").toLowerCase() === "transparent"
      );
      if (transparent && Array.isArray(transparent.rgb)) {
        this.rgbToMeta.set(defaceKey, {
          id: transparent.id,
          premium: !!transparent.premium,
          name: transparent.name,
        });
      }
    } catch (ignored) {}

    // Map other key to Other meta for UI naming and ID continuity
    try {
      this.rgbToMeta.set(keyOther, {
        id: "other",
        premium: false,
        name: "Other",
      });
    } catch (ignored) {}

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
    this.requiredPixelCount = result.requiredPixelCount;
    this.defacePixelCount = result.defacePixelCount;
    this.colorPalette = result.colorPalette;
    this.tilePrefixes = result.tilePrefixes;

    return {
      templateTiles: result.templateTiles,
      templateTilesBuffers: result.templateTilesBuffers,
    };
  }
}
