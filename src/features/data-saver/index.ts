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
import { sendCacheSizeToInject } from "@/content";
import { tileCacheDB } from "./cache-storage";

let enabled = false;
let button: HTMLButtonElement | null = null;
let badge: HTMLDivElement | null = null;

const createButton = (container: Element): void => {
  if (container.querySelector("#data-saver-btn")) return;

  // Create button container
  const btnContainer = document.createElement("div");
  btnContainer.style.cssText = "position: relative;";

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

  // Create settings cog icon
  const settingsIcon = document.createElement("button");
  settingsIcon.id = "data-saver-settings-btn";
  settingsIcon.className = "btn btn-xs btn-circle btn-ghost";
  settingsIcon.title = "Settings";
  settingsIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px;">
      <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd" />
    </svg>
  `;
  settingsIcon.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    z-index: 31;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.3);
  `;

  settingsIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    showSettingsModal();
  });

  btnContainer.appendChild(button);
  btnContainer.appendChild(settingsIcon);
  container.className += " flex flex-col-reverse gap-1";
  container.appendChild(btnContainer);
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
    background: rgba(88, 88, 88, 0.75);
    color: white;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 9999px;
    box-shadow: 0 0 8px rgba(77, 77, 77, 0.6);
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

const showSettingsModal = async (): Promise<void> => {
  const maxCacheSize = await DataSaverStorage.getMaxCacheSize();
  const currentCacheSize = await tileCacheDB.getCacheSize();
  const cachePercentage = Math.round((currentCacheSize / maxCacheSize) * 100);

  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box max-w-2xl">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-primary">
            <path d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625z" />
            <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
          </svg>
        </div>
        <div>
          <h3 class="font-bold text-xl">Offline Cache Settings</h3>
          <p class="text-sm opacity-70">Manage persistent tile cache</p>
        </div>
      </div>

      <!-- Info Alert -->
      <div class="alert alert-info mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 class="font-bold">What is this?</h3>
          <div class="text-xs">
            Cache tiles to browse offline. Tiles are saved to IndexedDB and persist across sessions.
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="stats shadow">
          <div class="stat p-4">
            <div class="stat-figure text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
                <path fill-rule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="stat-title text-xs">Cached Tiles</div>
            <div class="stat-value text-3xl">${currentCacheSize}</div>
            <div class="stat-desc text-xs">${cachePercentage}% of limit</div>
          </div>
        </div>

        <div class="stats shadow">
          <div class="stat p-4">
            <div class="stat-figure text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8">
                <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM6.262 6.072a8.25 8.25 0 1010.562-.766 4.5 4.5 0 01-1.318 1.357L14.25 7.5l.165.33a.809.809 0 01-1.086 1.085l-.604-.302a1.125 1.125 0 00-1.298.21l-.132.131c-.439.44-.439 1.152 0 1.591l.296.296c.256.257.622.374.98.314l1.17-.195c.323-.054.654.036.905.245l1.33 1.108c.32.267.46.694.358 1.1a8.7 8.7 0 01-2.288 4.04l-.723.724a1.125 1.125 0 01-1.298.21l-.153-.076a1.125 1.125 0 01-.622-1.006v-1.089c0-.298-.119-.585-.33-.796l-1.347-1.347a1.125 1.125 0 01-.21-1.298L9.75 12l-1.64-1.64a6 6 0 01-1.676-3.257l-.172-1.03z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="stat-title text-xs">Max Capacity</div>
            <div class="stat-value text-3xl">${maxCacheSize}</div>
            <div class="stat-desc text-xs">tiles limit</div>
          </div>
        </div>
      </div>

      <!-- Cache Size Slider -->
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text font-semibold">Maximum Cache Size</span>
          <span class="label-text-alt text-lg font-bold" id="cache-size-value">${maxCacheSize} tiles</span>
        </label>
        <input id="cache-size-slider" type="range" min="10" max="1000" value="${maxCacheSize}"
               class="range range-primary" step="10" />
        <div class="w-full flex justify-between text-xs px-2 mt-1 opacity-60">
          <span>10 (Min)</span>
          <span>500</span>
          <span>1000 (Max)</span>
        </div>
        <div class="label">
          <span class="label-text-alt opacity-70">
            <span id="estimated-size">~${Math.round((maxCacheSize * 50) / 1024)} MB</span> storage space
          </span>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-2">
          <span>Cache Usage</span>
          <span class="font-semibold">${currentCacheSize} / ${maxCacheSize} tiles</span>
        </div>
        <progress class="progress ${cachePercentage >= 90 ? 'progress-error' : cachePercentage >= 70 ? 'progress-warning' : 'progress-primary'} w-full" value="${currentCacheSize}" max="${maxCacheSize}"></progress>
      </div>

      <!-- Actions -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <button id="clear-cache-btn" class="btn btn-outline btn-error gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clip-rule="evenodd" />
          </svg>
          Clear All Cache
        </button>
        <button id="refresh-stats-btn" class="btn btn-outline btn-info gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd" />
          </svg>
          Refresh Stats
        </button>
      </div>

      <!-- Footer Buttons -->
      <div class="modal-action mt-6">
        <button id="cancel-btn" class="btn btn-ghost">Cancel</button>
        <button id="save-btn" class="btn btn-primary gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" />
          </svg>
          Save Settings
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="button" id="backdrop-btn">close</button>
    </form>
  `;

  document.body.appendChild(modal);

  const slider = modal.querySelector("#cache-size-slider") as HTMLInputElement;
  const valueDisplay = modal.querySelector("#cache-size-value") as HTMLSpanElement;
  const estimatedSizeDisplay = modal.querySelector("#estimated-size") as HTMLSpanElement;
  const saveBtn = modal.querySelector("#save-btn") as HTMLButtonElement;
  const cancelBtn = modal.querySelector("#cancel-btn") as HTMLButtonElement;
  const backdropBtn = modal.querySelector("#backdrop-btn") as HTMLButtonElement;
  const clearCacheBtn = modal.querySelector("#clear-cache-btn") as HTMLButtonElement;
  const refreshStatsBtn = modal.querySelector("#refresh-stats-btn") as HTMLButtonElement;

  // Update value display when slider changes
  slider.addEventListener("input", () => {
    const value = parseInt(slider.value, 10);
    valueDisplay.textContent = `${value} tiles`;
    // Estimate ~50KB per tile
    const estimatedMB = Math.round((value * 50) / 1024);
    estimatedSizeDisplay.textContent = `~${estimatedMB} MB`;
  });

  // Refresh stats button
  refreshStatsBtn.addEventListener("click", async () => {
    refreshStatsBtn.disabled = true;
    refreshStatsBtn.innerHTML = `
      <span class="loading loading-spinner loading-sm"></span>
      Refreshing...
    `;

    try {
      const newCacheSize = await tileCacheDB.getCacheSize();
      const newPercentage = Math.round((newCacheSize / parseInt(slider.value, 10)) * 100);

      // Update stats displays
      const cachedTilesValue = modal.querySelector(".stat-value") as HTMLElement;
      const cachedTilesDesc = modal.querySelector(".stat-desc") as HTMLElement;
      const progressBar = modal.querySelector("progress") as HTMLProgressElement;
      const usageText = modal.querySelector(".font-semibold") as HTMLElement;

      cachedTilesValue.textContent = newCacheSize.toString();
      cachedTilesDesc.textContent = `${newPercentage}% of limit`;
      progressBar.value = newCacheSize;
      progressBar.className = `progress ${newPercentage >= 90 ? 'progress-error' : newPercentage >= 70 ? 'progress-warning' : 'progress-primary'} w-full`;
      usageText.textContent = `${newCacheSize} / ${slider.value} tiles`;

      console.log("🧑‍🎨 : Stats refreshed");
    } catch (error) {
      console.error("🧑‍🎨 : Failed to refresh stats:", error);
    } finally {
      refreshStatsBtn.disabled = false;
      refreshStatsBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
          <path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd" />
        </svg>
        Refresh Stats
      `;
    }
  });

  // Clear cache button
  clearCacheBtn.addEventListener("click", async () => {
    const confirmed = confirm(
      "⚠️ This will delete all cached tiles.\n\nYou'll need to re-download tiles when browsing.\n\nContinue?"
    );

    if (confirmed) {
      clearCacheBtn.disabled = true;
      clearCacheBtn.innerHTML = `
        <span class="loading loading-spinner loading-sm"></span>
        Clearing...
      `;

      try {
        await tileCacheDB.clearCache();

        // Also clear memory cache in inject side
        window.postMessage(
          {
            source: "mr-wplace-cache-clear",
          },
          "*"
        );

        console.log("🧑‍🎨 : Cache cleared successfully");

        // Show success and close
        clearCacheBtn.classList.remove("btn-error");
        clearCacheBtn.classList.add("btn-success");
        clearCacheBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clip-rule="evenodd" />
          </svg>
          Cache Cleared!
        `;

        setTimeout(() => {
          modal.close();
          modal.remove();
        }, 1500);
      } catch (error) {
        console.error("🧑‍🎨 : Failed to clear cache:", error);
        clearCacheBtn.disabled = false;
        clearCacheBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clip-rule="evenodd" />
          </svg>
          Clear All Cache
        `;
        alert("Failed to clear cache. Please try again.");
      }
    }
  });

  const cleanup = () => {
    modal.remove();
  };

  const handleSave = async () => {
    const newSize = parseInt(slider.value, 10);
    await DataSaverStorage.setMaxCacheSize(newSize);
    await sendCacheSizeToInject();
    cleanup();
    console.log("🧑‍🎨 : Cache size updated:", newSize);
  };

  const handleCancel = () => {
    cleanup();
  };

  saveBtn.addEventListener("click", handleSave);
  cancelBtn.addEventListener("click", handleCancel);
  backdropBtn.addEventListener("click", handleCancel);

  modal.showModal();
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
