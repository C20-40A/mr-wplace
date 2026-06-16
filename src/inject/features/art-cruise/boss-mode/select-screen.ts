import { RIP_IMAGE_DATA_URL } from "../effects/rip-image";
import {
  ART_CRUISE_BOSS_LEVELS,
  getBossRecord,
  type ArtCruiseBossRecord,
} from "./storage";

type ArtCruiseBossSelectScreenOptions = {
  fontStack: string;
  onSelect: (level: number) => void;
  onBack: () => void;
};

const formatBestTime = (ms: number) => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

export class ArtCruiseBossSelectScreen {
  private root: HTMLDivElement | null = null;

  constructor(private readonly options: ArtCruiseBossSelectScreenOptions) {}

  mount = () => {
    if (this.root) return;

    const root = document.createElement("div");
    root.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1003;
      display: grid;
      place-items: center;
      pointer-events: auto;
      overflow: hidden;
      font-family: ${this.options.fontStack};
      color: #e0faff;
      background:
        radial-gradient(circle at 50% 28%, rgba(244, 114, 182, 0.22), transparent 24%),
        radial-gradient(circle at 52% 62%, rgba(34, 211, 238, 0.2), transparent 36%),
        linear-gradient(180deg, rgba(2, 6, 23, 0.34), rgba(2, 6, 23, 0.82));
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      width: min(88%, 460px);
      max-height: 84%;
      padding: 22px 22px 20px;
      border: 1px solid rgba(103, 232, 249, 0.8);
      border-bottom-color: rgba(244, 114, 182, 0.9);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.9));
      box-shadow:
        0 22px 70px rgba(0, 0, 0, 0.46),
        0 0 34px rgba(34, 211, 238, 0.3),
        inset 0 0 30px rgba(14, 165, 233, 0.12);
      display: flex;
      flex-direction: column;
      gap: 14px;
    `;

    const title = document.createElement("div");
    title.textContent = "BOSS";
    title.style.cssText = `
      color: #f8fdff;
      font-size: 26px;
      font-weight: 1000;
      letter-spacing: 2px;
      text-align: center;
      text-shadow:
        0 0 10px rgba(34, 211, 238, 0.9),
        2px 2px 0 rgba(244, 114, 182, 0.6);
    `;

    const list = document.createElement("div");
    list.style.cssText = `
      display: grid;
      gap: 8px;
      min-height: 0;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      touch-action: pan-y;
      padding-right: 4px;
    `;
    for (const level of ART_CRUISE_BOSS_LEVELS)
      list.appendChild(this.createBossCard(level));

    const backButton = this.createBackButton();
    backButton.addEventListener("click", this.options.onBack);

    panel.append(title, list, backButton);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;
  };

  destroy = () => {
    this.root?.remove();
    this.root = null;
  };

  private createBossCard = (level: number) => {
    const record = getBossRecord(level);
    const unlocked = Boolean(record);

    const card = document.createElement("button");
    card.type = "button";
    card.disabled = !unlocked;
    card.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 12px 14px;
      border: 1px solid ${unlocked ? "rgba(103, 232, 249, 0.7)" : "rgba(103, 232, 249, 0.22)"};
      border-radius: 6px;
      background: ${
        unlocked
          ? "linear-gradient(180deg, rgba(8, 47, 73, 0.9), rgba(15, 23, 42, 0.9))"
          : "rgba(15, 23, 42, 0.5)"
      };
      color: #e0faff;
      text-align: left;
      cursor: ${unlocked ? "pointer" : "default"};
      opacity: ${unlocked ? "1" : "0.55"};
      transition: transform 0.12s ease, filter 0.12s ease;
    `;

    const badge = document.createElement("div");
    badge.textContent = unlocked ? `LV.${level}` : "?";
    badge.style.cssText = `
      flex: 0 0 auto;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 6px;
      border: 1px solid rgba(244, 114, 182, 0.6);
      background: rgba(2, 6, 23, 0.7);
      font-size: 14px;
      font-weight: 1000;
      letter-spacing: 1px;
      color: ${unlocked ? "#f8fdff" : "rgba(224, 250, 255, 0.5)"};
    `;

    const info = document.createElement("div");
    info.style.cssText = `flex: 1 1 auto; min-width: 0;`;

    const name = document.createElement("div");
    name.textContent = unlocked ? `BOSS LV.${level}` : "LOCKED";
    name.style.cssText = `
      font-size: 13px;
      font-weight: 1000;
      letter-spacing: 1px;
    `;

    const sub = document.createElement("div");
    sub.style.cssText = `
      margin-top: 3px;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: rgba(224, 250, 255, 0.7);
    `;
    sub.textContent = unlocked
      ? `BEST ${formatBestTime((record as ArtCruiseBossRecord).bestTimeMs)}`
      : "Defeat to unlock";

    info.append(name, sub);
    card.append(badge, info);

    if (unlocked) {
      // クリア印（rip 画像）を右端に表示。
      const ripIcon = document.createElement("img");
      ripIcon.src = RIP_IMAGE_DATA_URL;
      ripIcon.alt = "cleared";
      ripIcon.style.cssText = `
        flex: 0 0 auto;
        width: 28px;
        height: 28px;
        image-rendering: pixelated;
        filter: drop-shadow(0 0 6px rgba(244, 114, 182, 0.7));
      `;
      card.appendChild(ripIcon);

      card.addEventListener("pointerenter", () => {
        card.style.filter = "brightness(1.18)";
      });
      card.addEventListener("pointerleave", () => {
        card.style.filter = "";
      });
      card.addEventListener("click", () => this.options.onSelect(level));
    }

    return card;
  };

  private createBackButton = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "BACK";
    button.style.cssText = `
      height: 44px;
      border: 1px solid rgba(103, 232, 249, 0.82);
      border-radius: 6px;
      background: linear-gradient(180deg, rgba(8, 47, 73, 0.94), rgba(15, 23, 42, 0.94));
      color: #f8fdff;
      font-size: 13px;
      font-weight: 1000;
      letter-spacing: 2px;
      cursor: pointer;
      transition: filter 0.12s ease;
    `;
    button.addEventListener("pointerenter", () => {
      button.style.filter = "brightness(1.18)";
    });
    button.addEventListener("pointerleave", () => {
      button.style.filter = "";
    });
    return button;
  };
}
