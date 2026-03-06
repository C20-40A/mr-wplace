import { DataSaverStorage } from "./storage";
import { t } from "@/i18n/manager";
import { showSettingsModal } from "./ui";

let enabled = false;
let badge: HTMLDivElement | null = null;
let badgeText: HTMLDivElement | null = null;
let settingsButton: HTMLButtonElement | null = null;

const createSettingsButton = (): void => {
  if (document.querySelector("#data-saver-settings-btn")) return;

  settingsButton = document.createElement("button");
  settingsButton.id = "data-saver-settings-btn";
  settingsButton.className = "btn btn-xs btn-circle";
  settingsButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;">
      <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd" />
    </svg>
  `;
  settingsButton.style.cssText = `
    position: absolute;
    top: 50%;
    left: calc(100% + 8px);
    transform: translateY(-50%);
    z-index: 46;
    pointer-events: auto;
    transition: opacity 0.3s ease;
  `;

  settingsButton.addEventListener("click", (e) => {
    e.stopPropagation();
    showSettingsModal();
  });

  badge?.appendChild(settingsButton);
};

const createBadge = (): void => {
  if (document.querySelector("#data-saver-badge")) return;

  badge = document.createElement("div");
  badge.id = "data-saver-badge";
  badge.className =
    "shadow-md border border-base-300 bg-base-100 text-base-content";
  badgeText = document.createElement("div");
  badgeText.id = "data-saver-badge-text";
  badgeText.innerHTML = `🪫 ${t`${"data_saver_on"}`}<br><span style="font-size: 10px; opacity: 0.8;">${t`${"data_saver_rendering_paused"}`}</span>`;
  badge.style.cssText = `
    position: fixed;
    top: 44px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 9999px;
    z-index: 45;
    transition: opacity 0.3s ease;
    opacity: ${enabled ? "1" : "0"};
    pointer-events: none;
    text-align: center;
    line-height: 1.2;
  `;
  badge.appendChild(badgeText);
  document.body.appendChild(badge);
  createSettingsButton();
};

const toggle = async (): Promise<void> => {
  enabled = !enabled;
  await DataSaverStorage.set(enabled);
  applyState(enabled);
  console.log("🧑‍🎨 : Data saver toggled:", enabled);
};

const updateUI = (): void => {
  if (!badge) return;

  if (badgeText) {
    badgeText.innerHTML = `🪫 ${t`${"data_saver_on"}`}<br><span style="font-size: 9px; opacity: 0.6;">${t`${"data_saver_rendering_paused"}`}</span>`;
  }
  badge.style.opacity = enabled ? "0.8" : "0";
  if (settingsButton) {
    settingsButton.style.opacity = enabled ? "0.8" : "0";
    settingsButton.style.pointerEvents = enabled ? "auto" : "none";
  }
};

const applyState = (enabled: boolean): void => {
  updateUI();
  window.postMessage(
    {
      source: "mr-wplace-data-saver-update",
      enabled,
    },
    "*",
  );
};

const init = async (): Promise<void> => {
  enabled = await DataSaverStorage.get();
  createBadge();
  applyState(enabled);
  console.log("🧑‍🎨 : Data saver initialized");
};

export const dataSaverAPI = {
  initDataSaver: init,
  getEnabled: () => enabled,
  toggleDataSaver: toggle,
  openSettings: showSettingsModal,
};
