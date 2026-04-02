import { setupElementObserver } from "@/components/element-observer";
import { ImageInspector } from "@/components/image-inspector";
import { createModal } from "@/components/modal";
import { Toast } from "@/components/toast";
import { findPositionModal } from "@/constants/selectors";
import { showFeatureHint } from "@/features/feature-hints";
import { TOOLBAR_ROW1_ID } from "@/features/position-info";
import { t } from "@/i18n/manager";
import { GalleryStorage } from "@/states/galleryStorage";
import {
  extractConnectedTileRegion,
  type ConnectedTileRegionResult,
  type ConnectedTileRegionTooLargeResult,
  getTilePixelColor,
} from "@/utils/inject-bridge";
import { getCurrentPosition } from "@/utils/position";
import { sendGalleryImagesToInject } from "@/core/bridge";

const BUTTON_ID = "tile-crop-save-btn";
const MODAL_MARKER_ID = "tile-crop-save-marker";
const DEFAULT_MAX_SELECTED_PIXELS = 40_000;
const DEFAULT_INCLUDE_DIAGONALS = true;

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

    if (visible) showFeatureHint("tile-crop-save-btn", button);
  }

  private loadPreviewCanvas = async (
    dataUrl: string,
  ): Promise<HTMLCanvasElement> => {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Failed to load preview image"));
      image.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create preview canvas");
    ctx.drawImage(image, 0, 0);

    return canvas;
  };

  private createInspector = async (
    container: HTMLElement | null,
    dataUrl: string,
    containerSize: number,
    maxZoom: number,
  ): Promise<ImageInspector | null> => {
    if (!container) return null;

    const canvas = await this.loadPreviewCanvas(dataUrl);
    container.style.padding = "0";
    canvas.style.position = "absolute";
    canvas.style.left = "50%";
    canvas.style.top = "50%";
    container.appendChild(canvas);

    return new ImageInspector(canvas, {
      containerSize,
      maxZoom,
    });
  };

  private createColorChipHtml = (
    color: [number, number, number, number],
    index: number,
  ): string => `
    <label class="btn btn-sm btn-outline" style="display:flex; align-items:center; gap:0.5rem; justify-content:flex-start;">
      <input type="checkbox" data-color-index="${index}" style="margin:0;">
      <span style="width:1rem; height:1rem; border-radius:0.25rem; border:1px solid rgba(0,0,0,0.18); background:rgba(${color[0]}, ${color[1]}, ${color[2]}, ${Math.max(color[3] / 255, 0.25)});"></span>
      rgb(${color[0]}, ${color[1]}, ${color[2]})
    </label>
  `;

  private showPreviewModal(
    result: ConnectedTileRegionResult,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const modalElements = createModal({
        id: "wplace-studio-tile-crop-preview-modal",
        title: t`${"add_to_gallery"}`,
        maxWidth: "28rem",
        containerStyle: "padding-bottom: 0;",
      });

      let resolved = false;
      let inspector: ImageInspector | null = null;

      modalElements.container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <div id="tile-crop-preview-stage" class="border border-base-300 rounded-lg bg-base-200/40" style="position:relative; overflow:hidden; display:flex; justify-content:center; align-items:center; min-height:18rem; height:18rem;"></div>
          <div class="text-xs opacity-70" style="text-align:center;">
            ${result.width} x ${result.height} / ${result.pixelCount}px
          </div>
          <div class="modal-action" style="margin-top:0;">
            <button type="button" id="tile-crop-preview-cancel" class="btn btn-ghost">${t`${"cancel"}`}</button>
            <button type="button" id="tile-crop-preview-save" class="btn btn-primary">${t`${"save"}`}</button>
          </div>
        </div>
      `;

      void this.createInspector(
        modalElements.container.querySelector("#tile-crop-preview-stage"),
        result.dataUrl,
        280,
        12,
      ).then((instance) => {
        inspector = instance;
      });

      const cleanup = () => {
        inspector?.destroy();
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

  private showTooLargeModal(
    result: ConnectedTileRegionTooLargeResult,
    currentMaxSelectedPixels: number,
    currentIncludeDiagonals: boolean,
  ): Promise<{
    excludedColors: Array<[number, number, number, number]>;
    maxSelectedPixels: number;
    includeDiagonals: boolean;
  } | null> {
    return new Promise((resolve) => {
      const modalElements = createModal({
        id: "wplace-studio-tile-crop-too-large-modal",
        title: t`${"add_to_gallery"}`,
        maxWidth: "32rem",
      });

      let resolved = false;
      let inspector: ImageInspector | null = null;
      const tooLargeText = t("tile_crop_selection_too_large").replace(
        "{count}",
        String(result.pixelCount),
      );

      modalElements.container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          <p class="text-sm opacity-80" style="margin:0;">
            ${tooLargeText}
          </p>
          <label style="display:flex; flex-direction:column; gap:0.35rem;">
            <span class="text-sm opacity-80">${t("tile_crop_max_selected_pixels")}</span>
            <input id="tile-crop-max-selected-pixels" type="number" min="1" step="1000" value="${currentMaxSelectedPixels}" class="input input-bordered input-sm">
          </label>
          <label class="label" style="justify-content:flex-start; gap:0.5rem; padding:0;">
            <input id="tile-crop-include-diagonals" type="checkbox" class="checkbox checkbox-sm" ${currentIncludeDiagonals ? "checked" : ""}>
            <span class="label-text">${t("tile_crop_include_diagonals")}</span>
          </label>
          <div id="tile-crop-too-large-stage" class="border border-base-300 rounded-lg bg-base-200/40" style="position:relative; overflow:hidden; display:flex; justify-content:center; align-items:center; min-height:16rem; height:16rem;"></div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(10rem, 1fr)); gap:0.5rem;">
            ${result.candidateColors
              .map((color, index) => this.createColorChipHtml(color, index))
              .join("")}
          </div>
          <div class="modal-action" style="margin-top:0;">
            <button type="button" id="tile-crop-too-large-cancel" class="btn btn-ghost">${t`${"cancel"}`}</button>
            <button type="button" id="tile-crop-too-large-redetect" class="btn btn-primary">${t("tile_crop_redetect")}</button>
          </div>
        </div>
      `;

      void this.createInspector(
        modalElements.container.querySelector("#tile-crop-too-large-stage"),
        result.dataUrl,
        240,
        10,
      ).then((instance) => {
        inspector = instance;
      });

      const cleanup = () => {
        inspector?.destroy();
        modalElements.destroy();
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      };

      const cancelButton = modalElements.container.querySelector(
        "#tile-crop-too-large-cancel",
      ) as HTMLButtonElement | null;
      const redetectButton = modalElements.container.querySelector(
        "#tile-crop-too-large-redetect",
      ) as HTMLButtonElement | null;
      const maxSelectedPixelsInput = modalElements.container.querySelector(
        "#tile-crop-max-selected-pixels",
      ) as HTMLInputElement | null;
      const includeDiagonalsInput = modalElements.container.querySelector(
        "#tile-crop-include-diagonals",
      ) as HTMLInputElement | null;
      const checkboxes = Array.from(
        modalElements.container.querySelectorAll<HTMLInputElement>(
          "input[data-color-index]",
        ),
      );

      cancelButton?.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        modalElements.modal.close();
        resolve(null);
      });

      redetectButton?.addEventListener("click", () => {
        if (resolved) return;
        resolved = true;
        modalElements.modal.close();
        resolve({
          excludedColors: checkboxes
            .filter((checkbox) => checkbox.checked)
            .map(
              (checkbox) =>
                result.candidateColors[Number(checkbox.dataset.colorIndex)],
            ),
          maxSelectedPixels: Math.max(
            1,
            Number.parseInt(maxSelectedPixelsInput?.value ?? "", 10) ||
              currentMaxSelectedPixels,
          ),
          includeDiagonals:
            includeDiagonalsInput?.checked ?? currentIncludeDiagonals,
        });
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
      let excludedColors: Array<[number, number, number, number]> = [];
      let maxSelectedPixels = DEFAULT_MAX_SELECTED_PIXELS;
      let includeDiagonals = DEFAULT_INCLUDE_DIAGONALS;
      let result = await extractConnectedTileRegion(
        position.lat,
        position.lng,
        excludedColors,
        maxSelectedPixels,
        includeDiagonals,
      );
      if (!result) return;

      while (result.kind === "too-large") {
        const nextDetectionOptions = await this.showTooLargeModal(
          result,
          maxSelectedPixels,
          includeDiagonals,
        );
        if (!nextDetectionOptions) return;

        excludedColors = nextDetectionOptions.excludedColors;
        maxSelectedPixels = nextDetectionOptions.maxSelectedPixels;
        includeDiagonals = nextDetectionOptions.includeDiagonals;
        result = await extractConnectedTileRegion(
          position.lat,
          position.lng,
          excludedColors,
          maxSelectedPixels,
          includeDiagonals,
        );
        if (!result) return;
      }

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
        excludedColors,
        maxSelectedPixels,
        includeDiagonals,
      });
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save connected tile region", error);
      Toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save selected template",
      );
    } finally {
      this.saving = false;
      this.button?.classList.remove("loading");
      this.scheduleRefresh();
    }
  }
}
