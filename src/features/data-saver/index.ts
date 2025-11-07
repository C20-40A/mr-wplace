import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import { findMyLocationContainer } from "@/constants/selectors";
import { DataSaverStorage } from "./storage";
import { t } from "@/i18n/manager";
import {
  IMG_ICON_DATA_SAVER_OFF,
  IMG_ICON_DATA_SAVER_ON,
} from "@/assets/iconImages";

let enabled = false;
let button: HTMLButtonElement | null = null;
let badge: HTMLDivElement | null = null;

const createButton = (container: Element): void => {
  if (container.querySelector("#data-saver-btn")) return;

  button = document.createElement("button");
  button.id = "data-saver-btn";
  button.className = "btn btn-lg sm:btn-xl btn-square shadow-md z-30";
  button.title = enabled ? t`${"data_saver_on"}` : t`${"data_saver_off"}`;

  const iconSrc = enabled ? IMG_ICON_DATA_SAVER_ON : IMG_ICON_DATA_SAVER_OFF;
  button.innerHTML = `
    <img src="${iconSrc}" alt="${t`${"data_saver"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">
  `;
  button.style.cssText = `
    background-color: ${enabled ? "#2ecc71" : ""};
    box-shadow: 0 0 8px ${enabled ? "#2ecc71" : ""};
    transition: all 0.3s ease;
  `;

  button.addEventListener("mouseenter", () => {
    if (button) button.style.transform = "scale(1.1)";
  });
  button.addEventListener("mouseleave", () => {
    if (button) button.style.transform = "scale(1)";
  });

  button.addEventListener("click", toggle);
  container.className += " flex flex-col-reverse gap-1";
  container.appendChild(button);
  console.log("🧑‍🎨 : Data saver button created");
};

const createBadge = (): void => {
  if (document.querySelector("#data-saver-badge")) return;

  badge = document.createElement("div");
  badge.id = "data-saver-badge";
  badge.innerHTML = `🪫 ${t`${"data_saver_on"}`}<br><span style="font-size: 10px; opacity: 0.8;">${t`${"data_saver_rendering_paused"}`}</span>`;
  badge.style.cssText = `
    position: fixed;
    top: 45px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(46, 204, 113, 0.75);
    color: white;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 9999px;
    box-shadow: 0 0 8px rgba(46, 204, 113, 0.6);
    z-index: 45;
    transition: opacity 0.3s ease;
    opacity: ${enabled ? "1" : "0"};
    pointer-events: none;
    text-align: center;
    line-height: 1.2;
  `;
  document.body.appendChild(badge);
};

const toggle = async (): Promise<void> => {
  enabled = !enabled;
  await DataSaverStorage.set(enabled);
  animatePulse();
  applyState(enabled);
  console.log("🧑‍🎨 : Data saver toggled:", enabled);
};

const animatePulse = (): void => {
  if (!button) return;
  button.animate(
    [
      { boxShadow: "0 0 8px #2ecc71" },
      { boxShadow: "0 0 16px #2ecc71" },
      { boxShadow: "0 0 8px #2ecc71" },
    ],
    { duration: 600, easing: "ease-in-out" }
  );
};

const updateUI = (): void => {
  if (!button || !badge) return;

  button.title = enabled ? t`${"data_saver_on"}` : t`${"data_saver_off"}`;
  button.style.backgroundColor = enabled ? "#2ecc71" : "";
  button.style.boxShadow = enabled ? "0 0 8px #2ecc71" : "";

  // Update icon image based on state
  const iconSrc = enabled ? IMG_ICON_DATA_SAVER_ON : IMG_ICON_DATA_SAVER_OFF;
  const img = button.querySelector("img");
  if (img) {
    img.src = iconSrc;
  }

  badge.innerHTML = `🪫 ${t`${"data_saver_on"}`}<br><span style="font-size: 10px; opacity: 0.8;">${t`${"data_saver_rendering_paused"}`}</span>`;
  badge.style.opacity = enabled ? "1" : "0";
};

const applyState = (enabled: boolean): void => {
  updateUI();
  window.postMessage(
    {
      source: "mr-wplace-data-saver-update",
      enabled,
    },
    "*"
  );
};

const init = async (): Promise<void> => {
  enabled = await DataSaverStorage.get();

  const buttonConfigs: ElementConfig[] = [
    {
      id: "data-saver-btn",
      getTargetElement: findMyLocationContainer,
      createElement: createButton,
    },
  ];

  setupElementObserver(buttonConfigs);
  createBadge();
  applyState(enabled);
  console.log("🧑‍🎨 : Data saver initialized");
};

export const dataSaverAPI = {
  initDataSaver: init,
};
