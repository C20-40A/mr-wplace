/**
 * ------------------------------------------------------------------
 * Types & Interfaces
 * ------------------------------------------------------------------
 */

// ユーザー提供のインターフェースを反映
interface LegacyGalleryItem {
  key: string;
  timestamp: number;
  dataUrl?: string; // 欠損テスト対象
  thumbnail?: string;
  title?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number }; // 欠損テスト対象
  drawEnabled?: boolean;
  layerOrder?: number;
  matchedColorStats?: Record<string, number>; // 欠損テスト対象
  totalColorStats?: Record<string, number>; // 欠損テスト対象
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >; // 欠損テスト対象
}

// テストシナリオ設定
interface TestScenario {
  name: string;
  // LegacyGalleryItemのオプションプロパティを上書きするための設定
  config: {
    width?: number;
    height?: number;
    title?: string | null; // null: undefinedをシミュレート, "": 空文字列
    dataUrlMissing?: boolean;
    positionMissing?: boolean;
    colorStatsMissing?: boolean;
    isHidden?: boolean;
    forceHuge?: boolean; // 巨大画像フラグ
    posTLX?: number; // 座標の上書き
    posTLY?: number;
    posPxX?: number;
    posPxY?: number;
  };
}

/**
 * ------------------------------------------------------------------
 * 🎨 Graphics Utility
 * ------------------------------------------------------------------
 */

const generateDebugImage = (
  text: string,
  color: string,
  width = 300,
  height = 300
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = Math.min(20, width * 0.05);
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.strokeRect(0, 0, width, height);

  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontSize = Math.min(width, height) * 0.15;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillText(text, width / 2, height / 2);

  ctx.font = `${fontSize * 0.5}px sans-serif`;
  ctx.fillText(`${width}x${height}`, width / 2, height / 2 + fontSize);

  const mimeType = width * height > 2000 * 2000 ? "image/jpeg" : "image/png";
  const quality = mimeType === "image/jpeg" ? 0.5 : undefined;

  return canvas.toDataURL(mimeType, quality);
};

const getRandomColor = (index: number) => {
  const colors = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEEAD",
    "#D4A5A5",
  ];
  return colors[index % colors.length];
};

// ダミーの色統計情報を生成 (テストのためシンプルな構造)
const generateDummyColorStats = () => ({
  matched: { red: 50, blue: 10 },
  total: { red: 100, blue: 50, white: 200 },
});

/**
 * ------------------------------------------------------------------
 * 🧪 Test Scenarios Definitions
 * ------------------------------------------------------------------
 */
const TEST_SCENARIOS: TestScenario[] = [
  {
    name: "Standard Item",
    config: { width: 300, height: 300 },
  },
  {
    name: "Wide Image & Title Missing (Undefined)",
    config: { width: 800, height: 300, title: null }, // title: undefinedをシミュレート
  },
  {
    name: "Tall Image & Empty Title",
    config: { width: 300, height: 800, title: "" },
  },
  {
    name: "Hidden Item & Negative Px Offset",
    config: { isHidden: true, posPxX: -50, posPxY: -50 }, // 負のピクセル座標
  },
  {
    name: "Missing Data URL (No Image Data)",
    config: { dataUrlMissing: true, title: "No Image Data" },
  },
  {
    name: "Missing Draw Position",
    config: { positionMissing: true, title: "Position Corrupted" },
  },
  {
    name: "Missing Color Stats",
    config: { colorStatsMissing: true, title: "Stats Missing" },
  },
  {
    name: "Massive Image (4000x8000)",
    config: {
      width: 4000,
      height: 8000,
      title: "Massive 4Kx8K",
      forceHuge: true,
    },
  },
];

/**
 * ------------------------------------------------------------------
 * 🛠 Generator Logic
 * ------------------------------------------------------------------
 */

/**
 * 🧪 Debug utility: Auto-generate Legacy Data
 * 全ての定義済みテストケースを生成し、Chrome Storageに保存します。
 */
export const debugAutoGenerateLegacy = async (): Promise<void> => {
  console.log(
    `🧑‍🎨 [DEBUG] Starting generation of ${TEST_SCENARIOS.length} legacy items...`
  );

  const items: Record<string, LegacyGalleryItem> = {};

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const scenario = TEST_SCENARIOS[i];
    const { config } = scenario;

    console.log(`   - Generating #${i}: [${scenario.name}]...`);

    const timestamp = Date.now() + i;
    const key = `gallery_gen_${timestamp}`;
    const color = getRandomColor(i);

    // 1. Generate Image Data
    let dataUrl: string | undefined = undefined;
    if (!config.dataUrlMissing) {
      if (config.forceHuge) {
        console.warn(
          "   ⚠️ Generating massive image... this may freeze momentarily."
        );
        // 巨大画像生成前にUIスレッドを開放
        await new Promise((r) => setTimeout(r, 50));
      }
      dataUrl = generateDebugImage(
        `#${i} ${scenario.name}`,
        color,
        config.width ?? 300,
        config.height ?? 300
      );
    }

    // 2. Build Position
    let drawPosition: LegacyGalleryItem["drawPosition"] = {
      TLX: config.posTLX ?? i * 10,
      TLY: config.posTLY ?? i * 10,
      PxX: config.posPxX ?? 50,
      PxY: config.posPxY ?? 50,
    };
    if (config.positionMissing) {
      drawPosition = undefined; // drawPositionプロパティ全体を欠損させる
    }

    // 3. Build Color Stats
    const stats = generateDummyColorStats();

    // 4. Build Legacy Item
    const item: LegacyGalleryItem = {
      key,
      timestamp,
      // dataUrl: 欠損テストのため、条件付きで代入
      ...(dataUrl && { dataUrl: dataUrl }),

      // title: null (undefined) か "" か通常の文字列を設定
      ...(config.title !== null && {
        title: config.title ?? `Item ${i} - ${scenario.name}`,
      }),

      // drawPosition: 欠損テストのため、条件付きで代入
      ...(drawPosition && { drawPosition: drawPosition }),

      drawEnabled: !config.isHidden,
      layerOrder: i,

      // Color Stats: 欠損テストのため、条件付きで代入
      ...(!config.colorStatsMissing && {
        matchedColorStats: stats.matched,
        totalColorStats: stats.total,
        perTileColorStats: {
          "0,0": { matched: stats.matched, total: stats.total },
        },
      }),

      // thumbnailプロパティは今回はスキップします
    };

    items[key] = item;
  }

  // Bulk Save
  console.log("💾 Saving to Chrome Storage...");
  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    // Clear migration flag
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove("mr-wplace-migration-version", resolve);
    });

    console.log(
      `✅ [DEBUG] Successfully generated ${TEST_SCENARIOS.length} items.`
    );
    alert(
      `Generated ${TEST_SCENARIOS.length} legacy items.\nReload page to test migration.`
    );
  } catch (e: any) {
    console.error("❌ Storage Error:", e);
    alert(
      "Error saving items. See console. (Quota exceeded? Check 'unlimitedStorage' permission)"
    );
  }
};

/**
 * 🛠 Legacy Import (Manual File) - 必要に応じて残す
 */
export const debugLegacyImport = (): void => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    const timestamp = Date.now();
    const key = `gallery_${timestamp}`;
    const item: LegacyGalleryItem = {
      key,
      timestamp,
      dataUrl,
      title: "Manual Import",
      drawPosition: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
      drawEnabled: true,
      layerOrder: 0,
    };

    chrome.storage.local.set({ [key]: item }, () => {
      chrome.storage.local.remove("mr-wplace-migration-version", () => {
        alert(`Saved manual item: ${key}`);
        window.location.reload();
      });
    });
    input.remove();
  };
  document.body.appendChild(input);
  input.click();
};
