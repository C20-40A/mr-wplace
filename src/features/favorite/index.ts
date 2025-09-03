import { Position, Favorite, ButtonConfig } from "./types";
import { CONFIG } from "./config";
import { FavoriteStorage, STORAGE_KEYS } from "./storage";
import { FavoriteUI } from "./ui";
import { ImportExportService } from "./import-export";
import { getCurrentPosition } from "../../utils/position";

export class WPlaceExtendedFavorites {
  constructor() {
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
        id: "favorite-btn",
        selector: CONFIG.selectors.favoriteButton,
        containerSelector: CONFIG.selectors.toggleOpacityButton,
        create: this.createFavoriteButton.bind(this),
      },
      {
        id: "save-btn",
        selector: '[data-wplace-save="true"]',
        containerSelector: CONFIG.selectors.saveContainer,
        create: this.createSaveButton.bind(this),
      },
    ];

    this.startButtonObserver(buttonConfigs);
    this.createModal();
  }

  startButtonObserver(configs: ButtonConfig[]): void {
    const ensureButtons = () => {
      configs.forEach((config) => {
        if (!document.querySelector(config.selector)) {
          const container = document.querySelector(config.containerSelector);
          if (container) {
            config.create(container);
          }
        }
      });
    };

    const observer = new MutationObserver(() => {
      ensureButtons();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ensureButtons();
  }

  createFavoriteButton(toggleButton: Element): void {
    const button = FavoriteUI.createFavoriteButton(toggleButton);
    button.addEventListener("click", () => this.openModal());
    console.log("⭐ WPlace Studio: Favorite button added");
  }

  createSaveButton(container: Element): void {
    const button = FavoriteUI.createSaveButton(container);
    button.addEventListener("click", () => this.addFavorite());
    console.log("⭐ WPlace Studio: Save button added");
  }

  createModal(): void {
    const modal = FavoriteUI.createModal();

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
      alert(
        "位置情報を取得できませんでした。マップをクリックしてから保存してください。"
      );
      return;
    }

    const name = prompt(
      "お気に入り名を入力してください:",
      `地点 (${position.lat.toFixed(3)}, ${position.lng.toFixed(3)})`
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

    this.showToast(`"${name}" を保存しました`);
  }

  async renderFavorites(): Promise<void> {
    const favorites = await FavoriteStorage.getFavorites();
    FavoriteUI.renderFavorites(favorites);
  }

  goTo(lat: number, lng: number, zoom: number): void {
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
  }

  async deleteFavorite(id: number): Promise<void> {
    if (!confirm("このお気に入りを削除しますか？")) return;

    const favorites = await FavoriteStorage.getFavorites();
    const filtered = favorites.filter((fav) => fav.id !== id);
    await FavoriteStorage.setValue(
      STORAGE_KEYS.favorites,
      JSON.stringify(filtered)
    );

    this.renderFavorites();
    this.showToast("削除しました");
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
