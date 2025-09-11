import { ButtonObserver } from "../../components/button-observer";
import { CONFIG } from "./config";
import { FavoriteStorage, STORAGE_KEYS } from "./storage";
import { ImportExportService } from "./import-export";
import { getCurrentPosition } from "../../utils/position";
import { t } from "../../i18n/manager";
import {
  createBookmarkButton,
  createBookmarkModal,
  createSaveBookmarkButton,
  renderBookmarks,
} from "./ui";

export class ExtendedBookmarks {
  private buttonObserver: ButtonObserver;

  constructor() {
    this.buttonObserver = new ButtonObserver();
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.observeAndInit()
      );
    } else {
      this.observeAndInit();
    }
  }

  observeAndInit() {
    const buttonConfigs = [
      {
        id: "bookmarks-btn",
        selector: CONFIG.selectors.bookmarksButton,
        containerSelector: CONFIG.selectors.toggleOpacityButton,
        create: this.createBookmarkFAB.bind(this),
      },
      {
        id: "save-btn",
        selector: '[data-wplace-save="true"]',
        containerSelector: CONFIG.selectors.positionModal,
        create: this.createSaveButton.bind(this),
      },
      {
        id: "snapshot-btn",
        selector: '[data-wplace-snapshot="true"]',
        containerSelector: CONFIG.selectors.toggleOpacityButton,
        create: this.createSnapshotButton.bind(this),
      },
    ];

    this.buttonObserver.startObserver(buttonConfigs);
    this.createModal();
  }

  createBookmarkFAB(toggleButton: Element): void {
    const button = createBookmarkButton(toggleButton);
    button.addEventListener("click", () => this.openModal());
    console.log("⭐ WPlace Studio: Favorite button added");
  }

  createSaveButton(container: Element): void {
    const button = createSaveBookmarkButton(container);
    button.addEventListener("click", () => this.addFavorite());
    console.log("⭐ WPlace Studio: Save button added");
  }

  createSnapshotButton(toggleButton: Element): void {
    const button = document.createElement("button");
    button.setAttribute("data-wplace-snapshot", "true");
    button.className = "btn btn-circle btn-sm btn-secondary ml-2";
    button.innerHTML = "📸";
    button.title = "Save Snapshot";
    
    toggleButton.parentNode?.insertBefore(button, toggleButton.nextSibling);
    
    button.addEventListener("click", async () => {
      const tileSnapshot = (window as any).wplaceStudio?.tileSnapshot;
      if (tileSnapshot) {
        try {
          const snapshotId = await tileSnapshot.saveSnapshot(520, 218);
          this.showToast(`Snapshot saved: ${snapshotId}`);
          console.log(`📸 Snapshot saved: ${snapshotId}`);
        } catch (error) {
          this.showToast(`Snapshot failed: ${error}`);
          console.error(`📸 Snapshot failed:`, error);
        }
      }
    });
    
    console.log("📸 WPlace Studio: Snapshot button added");
  }

  createModal(): void {
    const modal = createBookmarkModal();

    modal
      .querySelector("#wps-favorites-grid")!
      .addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const card = target.closest(".wps-favorite-card") as HTMLElement | null;
        const deleteBtn = target.closest(
          ".wps-delete-btn"
        ) as HTMLElement | null;

        if (deleteBtn?.dataset.id) {
          const id = parseInt(deleteBtn.dataset.id);
          this.deleteFavorite(id);
        } else if (
          card?.dataset.lat &&
          card?.dataset.lng &&
          card?.dataset.zoom
        ) {
          const lat = parseFloat(card.dataset.lat);
          const lng = parseFloat(card.dataset.lng);
          const zoom = parseFloat(card.dataset.zoom);
          this.goTo(lat, lng, zoom);
          modal.close();
        }
      });

    modal
      .querySelector("#wps-export-btn")!
      .addEventListener("click", async () => {
        const result = await ImportExportService.exportFavorites();
        this.showToast(result.message);
      });

    modal
      .querySelector("#wps-import-btn")!
      .addEventListener("click", async () => {
        const result = await ImportExportService.importFavorites();
        this.showToast(result.message);
        if (result.shouldRender) {
          this.renderFavorites();
        }
      });
  }

  openModal(): void {
    this.renderFavorites();
    (
      document.getElementById(
        "wplace-studio-favorite-modal"
      ) as HTMLDialogElement
    ).showModal();
  }

  async addFavorite(): Promise<void> {
    const position = getCurrentPosition();
    if (!position) {
      alert(t`${"location_unavailable_instruction"}`);
      return;
    }

    const name = prompt(
      t`${"enter_favorite_name"}`,
      t`${"location_point"} (${position.lat.toFixed(3)}, ${position.lng.toFixed(
        3
      )})`
    );
    if (!name) return;

    const favorite = {
      id: Date.now(),
      name: name,
      lat: position.lat,
      lng: position.lng,
      zoom: position.zoom || 14,
      date: new Date().toLocaleDateString("ja-JP"),
    };

    const favorites = await FavoriteStorage.getFavorites();
    favorites.push(favorite);
    await FavoriteStorage.setValue(
      STORAGE_KEYS.favorites,
      JSON.stringify(favorites)
    );

    this.showToast(t`"${name}" ${"saved_message"}`);
  }

  async renderFavorites(): Promise<void> {
    const favorites = await FavoriteStorage.getFavorites();
    renderBookmarks(favorites);
  }

  goTo(lat: number, lng: number, zoom: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
  }

  async deleteFavorite(id: number): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;

    const favorites = await FavoriteStorage.getFavorites();
    const filtered = favorites.filter((fav) => fav.id !== id);
    await FavoriteStorage.setValue(
      STORAGE_KEYS.favorites,
      JSON.stringify(filtered)
    );

    this.renderFavorites();
    this.showToast(t`${"deleted_message"}`);
  }

  showToast(message: string): void {
    const toast = document.createElement("div");
    toast.className = "toast toast-top toast-end z-50";
    toast.innerHTML = `
      <div class="alert alert-success">
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}
