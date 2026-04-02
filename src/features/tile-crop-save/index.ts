import { setupElementObserver } from "@/components/element-observer";
import { createModal } from "@/components/modal";
import { Toast } from "@/components/toast";
import { findPositionModal } from "@/constants/selectors";
import { TOOLBAR_ROW1_ID } from "@/features/position-info";
import { t } from "@/i18n/manager";
import { GalleryStorage } from "@/states/galleryStorage";
import {
  extractConnectedTileRegion,
  getTilePixelColor,
} from "@/utils/inject-bridge";
import { getCurrentPosition } from "@/utils/position";
import { sendGalleryImagesToInject } from "@/core/bridge";

const BUTTON_ID = "save-btn-fallback";
const MODAL_MARKER_ID = "tile-crop-save-marker";

export class TileCropSave {
  private button: HTMLButtonElement | null = null;
  private modalObserver: MutationObserver | null = null;
  private observedModal: Element | null = null;
  private refreshScheduled = false;
  private refreshToken = 0;
  private saving = false;

  constructor() {
    this.init();
  }

  private init(): void {
    setupElementObserver([
      {
        id: BUTTON_ID,
        getTargetElement: () => document.getElementById(TOOLBAR_ROW1_ID),
        createElement: (row) => {
          if (row.querySelector(`#${BUTTON_ID}`)) return;
          this.mountButton(row);
        },
      },
      {
        id: MODAL_MARKER_ID,
        getTargetElement: findPositionModal,
        createElement: (modal) => {
          if (!modal.querySelector(`#${MODAL_MARKER_ID}`)) {
            const marker = document.createElement("span");
            marker.id = MODAL_MARKER_ID;
            marker.style.display = "none";
            modal.appendChild(marker);
          }

          this.startModalObserver(modal);
          this.scheduleRefresh();
        },
      },
    ]);
  }

  private mountButton(row: Element): void {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.title = t`${"add_to_gallery"}`;
    button.className = "btn btn-xs btn-ghost";
    button.style.cssText =
      "display:none; height: 1.25rem; min-height: 1.25rem; width: 1.25rem; min-width: 1.25rem; padding: 0;";
    button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm120-80h320v-80H320v80Zm0-160h80v-80h-80v80Zm160 0h160v-160H480v160Zm-160-160h80v-160h-80v160Zm-120 0h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 0h280v-80H480v80Z"/></svg>';
    button.addEventListener("click", () => {
      void this.handleSave();
    });

    row.appendChild(button);
    this.button = button;
    this.scheduleRefresh();
  }

  private startModalObserver(modal: Element): void {
    if (this.observedModal === modal && this.modalObserver) return;

    this.modalObserver?.disconnect();
    this.observedModal = modal;
    this.modalObserver = new MutationObserver(() => {
      this.scheduleRefresh();
    });
    this.modalObserver.observe(modal, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private scheduleRefresh(): void {
    if (this.refreshScheduled) return;
    this.refreshScheduled = true;

    requestAnimationFrame(() => {
      this.refreshScheduled = false;
      void this.refreshButtonState();
    });
  }

  private async refreshButtonState(): Promise<void> {
    const button = this.button;
    if (!button?.isConnected) return;

    const modal = findPositionModal();
    const position = getCurrentPosition();
    if (!modal || !position) {
      button.style.display = "none";
      button.disabled = true;
      return;
    }

    const token = ++this.refreshToken;
    const color = await getTilePixelColor(position.lat, position.lng);
    if (token !== this.refreshToken || !button.isConnected) return;

    const visible = Boolean(color && color.a > 0);
    button.style.display = visible ? "" : "none";
    button.disabled = !visible || this.saving;
    button.classList.toggle("loading", this.saving);
  }

  private showPreviewModal(result: Awaited<ReturnType<typeof extractConnectedTileRegion>>): Promise<boolean> {
    if (!result) return Promise.resolve(false);

    return new Promise((resolve) => {
      const modalElements = createModal({
        id: "wplace-studio-tile-crop-preview-modal",
        title: t`${"add_to_gallery"}`,
        maxWidth: "28rem",
        containerStyle: "padding-bottom: 0;",
      });

      let resolved = false;
      modalElements.container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div class="border border-base-300 rounded-lg bg-base-200/40" style="display:flex; justify-content:center; align-items:center; padding:0.75rem; min-height:12rem;">
            <img src="${result.dataUrl}" alt="Selected pixels preview" style="max-width:100%; max-height:18rem; image-rendering:pixelated; object-fit:contain;">
          </div>
          <div class="text-xs opacity-70" style="text-align:center;">
            ${result.width} x ${result.height} / ${result.pixelCount}px
          </div>
          <div class="modal-action" style="margin-top:0;">
            <button type="button" id="tile-crop-preview-cancel" class="btn btn-ghost">${t`${"cancel"}`}</button>
            <button type="button" id="tile-crop-preview-save" class="btn btn-primary">${t`${"save"}`}</button>
          </div>
        </div>
      `;

      const cleanup = () => {
        modalElements.destroy();
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      const cancelButton = modalElements.container.querySelector(
        "#tile-crop-preview-cancel",
      ) as HTMLButtonElement | null;
      const saveButton = modalElements.container.querySelector(
        "#tile-crop-preview-save",
      ) as HTMLButtonElement | null;

      cancelButton?.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        modalElements.modal.close();
        resolve(false);
      });

      saveButton?.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        modalElements.modal.close();
        resolve(true);
      });

      modalElements.modal.addEventListener("close", cleanup, { once: true });
      modalElements.modal.showModal();
    });
  }

  private async handleSave(): Promise<void> {
    if (this.saving) return;

    const position = getCurrentPosition();
    if (!position) return;

    this.saving = true;
    this.button?.classList.add("loading");
    this.button && (this.button.disabled = true);

    try {
      const result = await extractConnectedTileRegion(position.lat, position.lng);
      if (!result) return;
      const shouldSave = await this.showPreviewModal(result);
      if (!shouldSave) return;

      const storage = new GalleryStorage();
      const key =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `template-${Date.now()}`;

      await storage.save({
        key,
        timestamp: Date.now(),
        dataUrl: result.dataUrl,
        drawEnabled: false,
      });
      await sendGalleryImagesToInject();
      Toast.success(t`${"saved_to_gallery"}`);

      console.log("🧑‍🎨 : Saved connected tile region", {
        key,
        width: result.width,
        height: result.height,
        pixelCount: result.pixelCount,
        origin: result.origin,
      });
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save connected tile region", error);
      Toast.error(
        error instanceof Error ? error.message : "Failed to save selected template",
      );
    } finally {
      this.saving = false;
      this.button?.classList.remove("loading");
      this.scheduleRefresh();
    }
  }
}
