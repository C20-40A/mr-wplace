/**
 * Debug utility for generating legacy snapshot data
 * Used to test migration from Chrome Storage to IndexedDB
 */

/**
 * Generate a 1000x1000 tile image with color and text
 */
const generateTileImage = (
  tileX: number,
  tileY: number,
  label: string,
  bgColor: string
): Promise<number[]> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1000, 1000);

    // Grid pattern
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 100, 0);
      ctx.lineTo(i * 100, 1000);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * 100);
      ctx.lineTo(1000, i * 100);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, 1000, 1000);

    // Center text
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Tile coordinates
    ctx.font = "bold 80px sans-serif";
    ctx.fillText(`(${tileX}, ${tileY})`, 500, 400);

    // Label
    ctx.font = "bold 60px sans-serif";
    ctx.fillText(label, 500, 520);

    // Timestamp
    ctx.font = "40px sans-serif";
    ctx.fillText(new Date().toLocaleString(), 500, 620);

    // Size indicator
    ctx.font = "30px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("1000x1000 px", 500, 700);

    // Convert to blob then to number array (legacy format)
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          resolve([]);
          return;
        }
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        resolve(Array.from(uint8Array));
      },
      "image/png",
      1.0
    );
  });
};

/**
 * Test scenarios for legacy snapshots
 */
const SNAPSHOT_SCENARIOS = [
  { tileX: 1819, tileY: 806, label: "Snapshot A", color: "#E74C3C" }, // Red
  { tileX: 1798, tileY: 905, label: "Snapshot B", color: "#3498DB" }, // Blue
  { tileX: 862, tileY: 1202, label: "Snapshot C", color: "#2ECC71" }, // Green
  { tileX: 694, tileY: 1417, label: "Snapshot D", color: "#9B59B6" }, // Purple
  { tileX: 602, tileY: 769, label: "Snapshot E", color: "#F39C12" }, // Orange
];

/**
 * Generate legacy snapshot data and save to Chrome Storage
 */
export const debugGenerateLegacySnapshots = async (): Promise<void> => {
  console.log(
    `🧑‍🎨 [DEBUG] Generating ${SNAPSHOT_SCENARIOS.length} legacy snapshots...`
  );

  const storage: Record<string, any> = {};
  const snapshotIndex: Array<{
    id: string;
    fullKey: string;
    timestamp: number;
    tileX: number;
    tileY: number;
  }> = [];

  for (let i = 0; i < SNAPSHOT_SCENARIOS.length; i++) {
    const scenario = SNAPSHOT_SCENARIOS[i];
    const timestamp = Date.now() - (SNAPSHOT_SCENARIOS.length - i) * 1000; // Stagger timestamps

    console.log(
      `   - Generating snapshot ${i + 1}/${SNAPSHOT_SCENARIOS.length}: ${
        scenario.label
      } at (${scenario.tileX}, ${scenario.tileY})...`
    );

    // Generate image data
    const imageData = await generateTileImage(
      scenario.tileX,
      scenario.tileY,
      scenario.label,
      scenario.color
    );

    const snapshotId = `${timestamp}_${scenario.tileX}_${scenario.tileY}`;
    const fullKey = `tile_snapshot_${snapshotId}`;

    // Legacy format: number array in Chrome Storage
    storage[fullKey] = imageData;

    // Add to index
    snapshotIndex.push({
      id: snapshotId,
      fullKey,
      timestamp,
      tileX: scenario.tileX,
      tileY: scenario.tileY,
    });

    // Small delay to avoid UI freeze
    await new Promise((r) => setTimeout(r, 100));
  }

  // Also generate tile_name entries
  storage["tile_name_1798_904"] = "Location A";
  storage["tile_name_1819_806"] = "Location B";

  // Save legacy index
  storage["tile_snapshots_index"] = {
    snapshots: snapshotIndex,
    lastUpdated: Date.now(),
  };

  console.log("💾 Saving to Chrome Storage...");

  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set(storage, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });

    // Clear migration flag to trigger migration
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove("mr-wplace-migration-version", resolve);
    });

    const totalSize = Object.values(storage).reduce((acc, val) => {
      if (Array.isArray(val)) return acc + val.length;
      return acc + JSON.stringify(val).length;
    }, 0);

    console.log(
      `✅ [DEBUG] Generated ${SNAPSHOT_SCENARIOS.length} legacy snapshots (~${(
        totalSize /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );
    alert(
      `Generated ${SNAPSHOT_SCENARIOS.length} legacy snapshots.\n` +
        `Total size: ~${(totalSize / 1024 / 1024).toFixed(2)} MB\n\n` +
        `Reload page to test migration.`
    );
  } catch (e: any) {
    console.error("❌ Storage Error:", e);
    alert(
      "Error saving snapshots. See console.\n" +
        "(Quota exceeded? Check 'unlimitedStorage' permission)"
    );
  }
};

/**
 * Show current snapshot storage status
 */
export const debugShowSnapshotStorage = async (): Promise<void> => {
  const result = await new Promise<Record<string, any>>((resolve) => {
    chrome.storage.local.get(null, resolve);
  });

  const snapshotKeys = Object.keys(result).filter((k) =>
    k.startsWith("tile_snapshot_")
  );
  const nameKeys = Object.keys(result).filter((k) =>
    k.startsWith("tile_name_")
  );

  let output = `=== Snapshot Storage Status ===\n\n`;
  output += `Snapshots: ${snapshotKeys.length}\n`;
  output += `Tile Names: ${nameKeys.length}\n`;
  output += `Index exists: ${result["tile_snapshots_index"] ? "Yes" : "No"}\n`;
  output += `Migration version: ${
    result["mr-wplace-migration-version"] || "Not set"
  }\n\n`;

  if (snapshotKeys.length > 0) {
    output += `--- Snapshots ---\n`;
    for (const key of snapshotKeys.slice(0, 10)) {
      const data = result[key];
      const size = Array.isArray(data) ? data.length : 0;
      output += `${key}: ${(size / 1024).toFixed(1)} KB\n`;
    }
    if (snapshotKeys.length > 10) {
      output += `... and ${snapshotKeys.length - 10} more\n`;
    }
  }

  if (nameKeys.length > 0) {
    output += `\n--- Tile Names ---\n`;
    for (const key of nameKeys) {
      output += `${key}: ${result[key]}\n`;
    }
  }

  console.log(output);
  alert(output);
};

/**
 * Clear all legacy snapshot data
 */
export const debugClearLegacySnapshots = async (): Promise<void> => {
  if (!confirm("Clear all legacy snapshot data from Chrome Storage?")) return;

  const result = await new Promise<Record<string, any>>((resolve) => {
    chrome.storage.local.get(null, resolve);
  });

  const keysToRemove = Object.keys(result).filter(
    (k) =>
      k.startsWith("tile_snapshot_") ||
      k.startsWith("tile_name_") ||
      k === "tile_snapshots_index" ||
      k === "timetravel_draw_states"
  );

  if (keysToRemove.length === 0) {
    alert("No legacy snapshot data found.");
    return;
  }

  await new Promise<void>((resolve) => {
    chrome.storage.local.remove(keysToRemove, resolve);
  });

  // Also clear migration flag
  await new Promise<void>((resolve) => {
    chrome.storage.local.remove("mr-wplace-migration-version", resolve);
  });

  alert(`Cleared ${keysToRemove.length} legacy snapshot entries.`);
};
