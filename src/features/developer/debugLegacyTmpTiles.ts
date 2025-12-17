/**
 * Debug utility for generating legacy tile_tmp_* data
 * tile_tmp_* は完全に不要なレガシーデータで、クリーンアップのテスト用
 */

/**
 * Generate a random large binary blob (simulating tile data)
 */
const generateRandomBlob = (sizeKB: number): number[] => {
  const size = sizeKB * 1024;
  const data = new Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
};

/**
 * Generate legacy tile_tmp_* entries for testing cleanup
 * tile_tmp_* は大きなデータで大量に存在する想定
 */
export const debugGenerateLegacyTmpTiles = async (
  count: number = 50
): Promise<void> => {
  console.log(`🧑‍🎨 [DEBUG] Generating ${count} legacy tile_tmp_* entries...`);

  const storage: Record<string, any> = {};
  let totalSize = 0;

  for (let i = 0; i < count; i++) {
    const tileX = Math.floor(Math.random() * 2000);
    const tileY = Math.floor(Math.random() * 2000);
    const timestamp = Date.now() - i * 1000;
    const key = `tile_tmp_${timestamp}_${tileX}_${tileY}`;

    // Each tile_tmp is 100-500KB (large data)
    const sizeKB = 100 + Math.floor(Math.random() * 400);
    storage[key] = generateRandomBlob(sizeKB);
    totalSize += sizeKB * 1024;

    if ((i + 1) % 10 === 0) {
      console.log(`   - Generated ${i + 1}/${count} entries...`);
    }
  }

  console.log("💾 Saving to Chrome Storage...");

  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(storage, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    // Clear migration flag to trigger cleanup
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove("migration_tile_tmp_cleanup_v1", resolve);
    });

    console.log(
      `✅ [DEBUG] Generated ${count} legacy tile_tmp_* entries (~${(
        totalSize /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );
    alert(
      `Generated ${count} legacy tile_tmp_* entries.\n` +
        `Total size: ~${(totalSize / 1024 / 1024).toFixed(2)} MB\n\n` +
        `Reload page to test cleanup.`
    );
  } catch (e: any) {
    console.error("❌ Storage Error:", e);
    alert(
      "Error saving tile_tmp data. See console.\n" +
        "(Quota exceeded? Check 'unlimitedStorage' permission)"
    );
  }
};

/**
 * Show current tile_tmp_* storage status
 */
export const debugShowTmpTilesStorage = async (): Promise<void> => {
  const allKeys = await new Promise<string[]>((resolve) => {
    chrome.storage.local.get(null, (items) => {
      resolve(Object.keys(items));
    });
  });

  const tmpKeys = allKeys.filter((k) => k.startsWith("tile_tmp_"));

  let output = `=== tile_tmp_* Storage Status ===\n\n`;
  output += `tile_tmp_* count: ${tmpKeys.length}\n`;
  output += `Cleanup migration done: ${
    allKeys.includes("migration_tile_tmp_cleanup_v1") ? "Yes" : "No"
  }\n\n`;

  if (tmpKeys.length > 0) {
    output += `--- Sample Keys (first 20) ---\n`;
    for (const key of tmpKeys.slice(0, 20)) {
      output += `${key}\n`;
    }
    if (tmpKeys.length > 20) {
      output += `... and ${tmpKeys.length - 20} more\n`;
    }
  }

  console.log(output);
  alert(output);
};

/**
 * Clear all tile_tmp_* data
 */
export const debugClearLegacyTmpTiles = async (): Promise<void> => {
  if (!confirm("Clear all tile_tmp_* data from Chrome Storage?")) return;

  const allKeys = await new Promise<string[]>((resolve) => {
    chrome.storage.local.get(null, (items) => {
      resolve(Object.keys(items));
    });
  });

  const keysToRemove = allKeys.filter((k) => k.startsWith("tile_tmp_"));

  if (keysToRemove.length === 0) {
    alert("No tile_tmp_* data found.");
    return;
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(keysToRemove, resolve);
  });

  // Also clear migration flag
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove("migration_tile_tmp_cleanup_v1", resolve);
  });

  alert(`Cleared ${keysToRemove.length} tile_tmp_* entries.`);
};
