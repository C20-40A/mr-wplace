import { DataSaverStorage } from "./storage";
import { tileCacheDB } from "./cache-storage";
import { sendCacheSizeToInject } from "@/content";

/**
 * Show settings modal for cache management
 */
export const showSettingsModal = async (): Promise<void> => {
  const maxCacheSize = await DataSaverStorage.getMaxCacheSize();
  const currentCacheSize = await tileCacheDB.getCacheSize();

  const modal = createModal(maxCacheSize, currentCacheSize);
  document.body.appendChild(modal);

  setupModalHandlers(modal, maxCacheSize);
  modal.showModal();
};

/**
 * Create modal HTML structure
 */
const createModal = (
  maxCacheSize: number,
  currentCacheSize: number
): HTMLDialogElement => {
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
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-2">
          <span>Cache Usage</span>
          <span class="font-semibold">${currentCacheSize} / ${maxCacheSize} tiles</span>
        </div>
        <progress class="progress ${getProgressClass(cachePercentage)} w-full" value="${currentCacheSize}" max="${maxCacheSize}"></progress>
      </div>

      <!-- Cache Size Slider -->
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text font-semibold">Maximum Cache Size</span>
        </label>
        <div class="flex items-center gap-4">
          <input id="cache-size-slider" type="range" min="10" max="1000" value="${maxCacheSize}"
                 class="range range-primary" step="10" style="flex: 1 1 auto; min-width: 0;" />
          <div class="text-right" style="flex-shrink: 0;">
            <div class="text-lg font-bold" id="cache-size-value">${maxCacheSize} tiles</div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="mb-4">
        <button id="clear-cache-btn" class="btn btn-outline btn-error gap-2 w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clip-rule="evenodd" />
          </svg>
          Clear All Cache
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

  return modal;
};

/**
 * Get progress bar class based on percentage
 */
const getProgressClass = (percentage: number): string => {
  return "progress-primary";
};

/**
 * Setup all modal event handlers
 */
const setupModalHandlers = (
  modal: HTMLDialogElement,
  initialMaxCacheSize: number
): void => {
  const slider = modal.querySelector("#cache-size-slider") as HTMLInputElement;
  const valueDisplay = modal.querySelector(
    "#cache-size-value"
  ) as HTMLDivElement;
  const saveBtn = modal.querySelector("#save-btn") as HTMLButtonElement;
  const cancelBtn = modal.querySelector("#cancel-btn") as HTMLButtonElement;
  const backdropBtn = modal.querySelector(
    "#backdrop-btn"
  ) as HTMLButtonElement;
  const clearCacheBtn = modal.querySelector(
    "#clear-cache-btn"
  ) as HTMLButtonElement;

  // Slider input handler
  slider.addEventListener("input", () => {
    const value = parseInt(slider.value, 10);
    valueDisplay.textContent = `${value} tiles`;
  });

  // Clear cache handler
  clearCacheBtn.addEventListener("click", async () => {
    await handleClearCache(modal, clearCacheBtn);
  });

  // Save handler
  saveBtn.addEventListener("click", async () => {
    const newSize = parseInt(slider.value, 10);
    await DataSaverStorage.setMaxCacheSize(newSize);
    await sendCacheSizeToInject();
    modal.close();
    modal.remove();
    console.log("🧑‍🎨 : Cache size updated:", newSize);
  });

  // Cancel handlers
  const handleCancel = () => {
    modal.close();
    modal.remove();
  };
  cancelBtn.addEventListener("click", handleCancel);
  backdropBtn.addEventListener("click", handleCancel);
};

/**
 * Handle clear cache button click
 */
const handleClearCache = async (
  modal: HTMLDialogElement,
  clearCacheBtn: HTMLButtonElement
): Promise<void> => {
  const confirmed = confirm(
    "⚠️ This will delete all cached tiles.\n\nYou'll need to re-download tiles when browsing.\n\nContinue?"
  );

  if (!confirmed) return;

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
};
