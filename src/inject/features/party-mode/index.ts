import type { CapturedPaintedCoordinate } from "@/inject/types";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import {
  burst,
  centerText,
  confettiRain,
  destroyFx,
  floatText,
  screenFlash,
  screenShake,
} from "./fx";
import { closeAudio, playBlip, playFanfare, playMilestone } from "./sound";

/**
 * 演出強化モード（パーティーモード）
 * OFF 時は notify* が先頭で return するだけで、DOM/RAF/Audio を一切持たない
 */

const COMBO_TIMEOUT_MS = 1500;
const COMMIT_DEBOUNCE_MS = 400;
const MILESTONES: [number, string][] = [
  [10, "NICE!"],
  [25, "GREAT!!"],
  [50, "EXCELLENT!!!"],
  [100, "AMAZING!!!!"],
  [200, "GODLIKE!!!!!"],
  [500, "LEGENDARY!!!!!!"],
];

let enabled = false;
let combo = 0;
let lastPaintAt = 0;
let placedSinceCommit = 0;
let commitTimer: ReturnType<typeof setTimeout> | null = null;

export const setPartyModeEnabled = (value: boolean) => {
  enabled = value;
  if (enabled) return;
  combo = 0;
  placedSinceCommit = 0;
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = null;
  destroyFx();
  closeAudio();
};

const toScreen = (c: CapturedPaintedCoordinate) => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) return null;
  const { lat, lng } = tilePixelToLatLng(
    c.tileX,
    c.tileY,
    c.pixelX + 0.5,
    c.pixelY + 0.5,
  );
  const point = map.project([lng, lat]);
  const rect = map.getContainer().getBoundingClientRect();
  return { x: rect.left + point.x, y: rect.top + point.y };
};

const handlePaint = (c: CapturedPaintedCoordinate) => {
  const now = performance.now();
  combo = now - lastPaintAt < COMBO_TIMEOUT_MS ? combo + 1 : 1;
  lastPaintAt = now;
  placedSinceCommit++;

  const pos = toScreen(c);
  if (pos) {
    const color = c.color
      ? `rgb(${c.color.r},${c.color.g},${c.color.b})`
      : "#ffd700";
    const power = 1 + Math.min(combo, 100) / 40;
    burst(pos.x, pos.y, color, 8 + Math.min(combo, 40), power);
    floatText(`${combo}`, pos.x, pos.y - 24, {
      size: 16 + Math.min(combo, 60) / 3,
      rainbow: combo >= 25,
      color: "#ffd700",
      life: 35,
    });
  }
  playBlip(combo);

  const tier = MILESTONES.findIndex(([n]) => n === combo);
  if (tier === -1) return;
  centerText(MILESTONES[tier][1], 48 + tier * 10, 70);
  floatText(`${combo} COMBO`, window.innerWidth / 2, window.innerHeight * 0.4 + 56, {
    size: 26,
    color: "#fff",
    life: 70,
  });
  screenShake(4 + tier * 3);
  screenFlash(0.15 + tier * 0.05, "255,255,255");
  playMilestone(tier);
};

const handleCommit = () => {
  commitTimer = null;
  const count = placedSinceCommit;
  placedSinceCommit = 0;
  if (count === 0) return;

  const big = count >= 100;
  centerText(big ? "JACKPOT!!!" : "FEVER!!", big ? 96 : 72, 150);
  floatText(`${count} PX!!`, window.innerWidth / 2, window.innerHeight * 0.4 + 80, {
    size: big ? 48 : 36,
    rainbow: true,
    life: 150,
  });
  confettiRain(Math.min(80 + count * 2, 600));
  screenFlash(big ? 0.7 : 0.45);
  screenShake(big ? 18 : 10);
  playFanfare(big);
};

/** 1px 置かれた瞬間（painted-coordinates-capture から） */
export const notifyPartyPaint = (c: CapturedPaintedCoordinate) => {
  if (!enabled) return;
  // wplace 本体の Map.set フック内で呼ばれるので絶対に throw しない
  try {
    handlePaint(c);
  } catch (error) {
    console.warn("🧑‍🎨 : party paint fx failed", error);
  }
};

/** Paint 確定 POST 成功（タイル単位で複数回来るので debounce） */
export const notifyPartyPaintCommit = () => {
  if (!enabled) return;
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => {
    try {
      handleCommit();
    } catch (error) {
      console.warn("🧑‍🎨 : party commit fx failed", error);
    }
  }, COMMIT_DEBOUNCE_MS);
};
