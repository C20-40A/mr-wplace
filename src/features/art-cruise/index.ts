import { SHIP_IMAGE_DATA_URL } from "@/inject/features/art-cruise/player/ship";
import { runtime } from "@/utils/browser-api";

const BUTTON_ID = "mr-wplace-art-cruise-btn";
const SHOW_HITBOXES_STORAGE_KEY = "mr-wplace-art-cruise-show-hitboxes";
const ART_CRUISE_CONFIG = {
  debug: {
    showHitboxes: false,
  },
} as const;

let active = false;
let savedMapZIndex = "";
let hiddenEls: { el: HTMLElement; display: string }[] = [];

const getArtCruiseConfig = () => ({
  ...ART_CRUISE_CONFIG,
  debug: {
    ...ART_CRUISE_CONFIG.debug,
    showHitboxes:
      ART_CRUISE_CONFIG.debug.showHitboxes ||
      localStorage.getItem(SHOW_HITBOXES_STORAGE_KEY) === "true",
  },
});

const notifyInject = (enabled: boolean) =>
  window.postMessage(
    {
      source: "mr-wplace-art-cruise-update",
      enabled,
      fontUrl: runtime.getURL("assets/fonts/misaki/misaki_gothic.ttf"),
      mandalaUrls: {
        b: runtime.getURL("assets/art-cruise/mandala/mandala-b.png"),
        c: runtime.getURL("assets/art-cruise/mandala/mandala-c.png"),
      },
      audioUrls: {
        stage: runtime.getURL("assets/art-cruise/audio/stage.ogg"),
        boss: runtime.getURL("assets/art-cruise/audio/boss.ogg"),
        boss2: runtime.getURL("assets/art-cruise/audio/boss2.ogg"),
        gameOver: runtime.getURL("assets/art-cruise/audio/game-over.ogg"),
        se: {
          "player-shoot": runtime.getURL(
            "assets/art-cruise/audio/se/player-shoot.wav",
          ),
          "boss-explosion": runtime.getURL(
            "assets/art-cruise/audio/se/explosion.wav",
          ),
          "player-hit": runtime.getURL(
            "assets/art-cruise/audio/se/hit-pyun.wav",
          ),
          "player-dead": runtime.getURL(
            "assets/art-cruise/audio/se/player-dead.wav",
          ),
          "grunt-down": runtime.getURL(
            "assets/art-cruise/audio/se/grunt-down.wav",
          ),
          "enemy-shot": runtime.getURL(
            "assets/art-cruise/audio/se/enemy-shot.wav",
          ),
          "enemy-shot-short": runtime.getURL(
            "assets/art-cruise/audio/se/enemy-shot-short.wav",
          ),
        },
      },
      debug: getArtCruiseConfig().debug,
    },
    "*",
  );

// 3D は inject 側 startArtCruise/stopArtCruise が直接制御するので content からは送らない

// wplace の UI パネルを隠してマップだけ見せる
const hideWplaceUI = () => {
  const map = document.querySelector<HTMLElement>("#map");
  if (map) {
    savedMapZIndex = map.style.zIndex;
    map.style.zIndex = "999";
  }

  // マップ以外の fixed/absolute な UI 要素を非表示
  const candidates = document.querySelectorAll<HTMLElement>(
    ".absolute, .fixed, [class*='z-']",
  );
  hiddenEls = [];
  for (const el of candidates) {
    if (el.id === BUTTON_ID) continue;
    if (map?.contains(el)) continue;
    if (el === map) continue;
    const style = getComputedStyle(el);
    if (
      (style.position === "fixed" || style.position === "absolute") &&
      style.display !== "none"
    ) {
      hiddenEls.push({ el, display: el.style.display });
      el.style.display = "none";
    }
  }
};

const showWplaceUI = () => {
  const map = document.querySelector<HTMLElement>("#map");
  if (map) map.style.zIndex = savedMapZIndex;

  for (const { el, display } of hiddenEls) {
    el.style.display = display;
  }
  hiddenEls = [];
};

const updateButtonStyle = () => {
  const btn = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (!btn) return;
  btn.style.opacity = active ? "1" : "";
  btn.style.transform = active ? "scale(1.1)" : "scale(1)";
  btn.style.filter = active ? "drop-shadow(0 0 6px oklch(var(--p)))" : "";
};

const activate = () => {
  active = true;
  notifyInject(true);
  hideWplaceUI();
  updateButtonStyle();
  console.log("🧑‍🎨 : Art cruise on");
};

const deactivate = () => {
  if (!active) return;
  active = false;
  notifyInject(false);
  showWplaceUI();
  updateButtonStyle();
  console.log("🧑‍🎨 : Art cruise off");
};

const toggle = () => (active ? deactivate() : activate());

window.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.source !== "mr-wplace-art-cruise-exit") return;
  deactivate();
});

// const ROCKET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`;
const ROCKET_IMG = document.createElement("img");
ROCKET_IMG.src = SHIP_IMAGE_DATA_URL;

export const createArtCruiseButton = (): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.title = "Art Cruise Shooter";
  btn.className = "btn btn-sm btn-circle";
  btn.appendChild(ROCKET_IMG);
  btn.style.cssText = `
    position: relative;
    z-index: 10;
    transition: opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease;
  `;
  btn.addEventListener("click", toggle);
  return btn;
};
