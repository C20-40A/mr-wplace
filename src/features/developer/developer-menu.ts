// ==========================================
// 1. 設定: ここにボタンを追加してください

import {
  debugLegacyImport,
  debugAutoGenerateLegacy,
} from "./debugLegacyGalleryImport";

import {
  debugGenerateLegacySnapshots,
  debugShowSnapshotStorage,
  debugClearLegacySnapshots,
} from "./debugLegacySnapshotImport";

import {
  debugGenerateLegacyTmpTiles,
  debugShowTmpTilesStorage,
  debugClearLegacyTmpTiles,
} from "./debugLegacyTmpTiles";

import {
  syncIndexedDBToStorage,
  syncStorageToIndexedDB,
  cleanStorageSync,
} from "./debugGallerySync";

import { storage } from "@/utils/browser-api";

// ==========================================
const ACTIONS = [
  {
    label: "🔴 Turn OFF Dev Mode",
    action: async () => {
      if (!confirm("Turn off developer mode? Page will reload.")) return;
      await storage.set({ "mr-wplace-auto-spoit-dev-mode": false });
      location.reload();
    },
  },
  {
    label: "Legacy Gallery Import",
    action: debugLegacyImport,
  },
  {
    label: "Auto-generate Legacy Gallery",
    action: debugAutoGenerateLegacy,
  },
  {
    label: "Generate Legacy Snapshots",
    action: debugGenerateLegacySnapshots,
  },
  {
    label: "Show Snapshot Storage",
    action: debugShowSnapshotStorage,
  },
  {
    label: "Clear Legacy Snapshots",
    action: debugClearLegacySnapshots,
  },
  {
    label: "Generate Legacy tile_tmp_*",
    action: () => debugGenerateLegacyTmpTiles(50), // 50個生成
  },
  {
    label: "Show tile_tmp_* Storage",
    action: debugShowTmpTilesStorage,
  },
  {
    label: "Clear tile_tmp_* Data",
    action: debugClearLegacyTmpTiles,
  },
  {
    label: "⚠️ DANGER: Sync IndexedDB → Storage",
    action: syncIndexedDBToStorage,
  },
  {
    label: "⚠️ DANGER: Sync Storage → IndexedDB",
    action: syncStorageToIndexedDB,
  },
  {
    label: "⚠️ DANGER: Clean Storage Sync",
    action: cleanStorageSync,
  },
  {
    label: "Show LocalStorage",
    action: () => {
      const entries = Object.entries(localStorage);
      if (entries.length === 0) {
        alert("localStorage is empty.");
        return;
      }
      let output = "localStorage contents:\n\n";
      entries.forEach(([key, value]) => {
        output += `${key}: ${value}\n`;
      });
      alert(output);
    },
  },
  {
    label: "Clear Storage",
    action: () => {
      // confirm
      if (!confirm("Are you sure you want to clear localStorage?")) return;
      localStorage.clear();
      alert("Cleared!");
    },
  },
];

// ==========================================
// 2. UI構築 (Minimal Dark UI)
// ==========================================

export const setupDeveloperMenu = (): void => {
  // スタイル定義 (CSS in JS)
  const S = {
    font: "12px sans-serif",
    z: "999999",
    btn: "cursor:pointer; border:none; color:#fff; padding:8px 12px; margin:4px; border-radius:4px; width:100%; text-align:left;",
    dark: "background:rgba(0,0,0,0.85); backdrop-filter:blur(4px); color:#fff;",
  };

  // DOM生成ヘルパー
  const el = (tag: string, css: string, txt: string = "") => {
    const e = document.createElement(tag);
    e.style.cssText = css;
    e.textContent = txt;
    return e;
  };

  // --- Main Menu Panel ---
  const menu = el(
    "div",
    `
    ${S.dark} position:fixed; top:50px; left:10px; z-index:${S.z};
    padding:10px; border-radius:6px; display:none; min-width:200px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5); font:${S.font};
  `,
  );

  // Close Button (Right Top)
  const closeBtn = el(
    "button",
    "position:absolute; top:5px; right:5px; background:none; border:none; color:#aaa; cursor:pointer; font-size:16px;",
    "×",
  );
  closeBtn.onclick = () => (menu.style.display = "none");
  menu.appendChild(closeBtn);

  // Title
  menu.appendChild(
    el("div", "margin-bottom:8px; font-weight:bold; color:#ccc;", "Dev Menu"),
  );

  // Action Buttons生成
  ACTIONS.forEach(({ label, action }) => {
    const btn = el(
      "button",
      `${S.btn} background:#444; transition:0.2s;`,
      label,
    );
    btn.onmouseover = () => (btn.style.background = "#666");
    btn.onmouseout = () => (btn.style.background = "#444");
    btn.onclick = async () => {
      await Promise.resolve(action());
      menu.style.display = "none";
    }; // 実行後閉じる
    menu.appendChild(btn);
  });

  // --- Toggle Icon (Left Top) ---
  const icon = el(
    "button",
    `
    ${S.dark} position:fixed; top:8px; left:86px; z-index:${S.z};
    width:32px; height:32px; border-radius:50%; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center; font-size:16px;
  `,
    "🛠️",
  );

  icon.onclick = () => {
    const isHidden = menu.style.display === "none";
    menu.style.display = isHidden ? "block" : "none";
  };

  // Inject
  document.body.appendChild(icon);
  document.body.appendChild(menu);
};
