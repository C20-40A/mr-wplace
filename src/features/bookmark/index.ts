import { ButtonObserver } from "../../components/button-observer";
import { Toast } from "../../components/toast";
import { CONFIG } from "./config";
import { FavoriteStorage, STORAGE_KEYS } from "./storage";
import { ImportExportService } from "./import-export";
import { getCurrentPosition, gotoPosition } from "../../utils/position";
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

  createModal(): void {
    const modalElements = createBookmarkModal();
    const modal = modalElements.modal;

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
          gotoPosition({ lat, lng, zoom });
          modal.close();
        }
      });

    modal
      .querySelector("#wps-export-btn")!
      .addEventListener("click", async () => {
        const result = await ImportExportService.exportFavorites();
        Toast.success(result.message);
      });

    modal
      .querySelector("#wps-import-btn")!
      .addEventListener("click", async () => {
        const result = await ImportExportService.importFavorites();
        Toast.success(result.message);
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
      t`${"enter_bookmark_name"}`,
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

    Toast.success(t`"${name}" ${"saved_message"}`);
  }

  async renderFavorites(): Promise<void> {
    const favorites = await FavoriteStorage.getFavorites();
    renderBookmarks(favorites);
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
    Toast.success(t`${"deleted_message"}`);
  }
}
