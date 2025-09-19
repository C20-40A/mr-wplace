import { setupButtonObserver } from "../../components/button-observer";
import { Toast } from "../../components/toast";
import { CONFIG } from "./config";
import { BookmarkStorage } from "./storage";
import { ImportExportService } from "./import-export";
import { getCurrentPosition, gotoPosition } from "../../utils/position";
import { showNameInputModal } from "../../utils/modal";
import { t, formatDateShort } from "../../i18n/manager";
import {
  createBookmarkButton,
  createBookmarkModal,
  createSaveBookmarkButton,
  renderBookmarks,
} from "./ui";

export class ExtendedBookmarks {
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
    setupButtonObserver([
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
    ]);
    this.createModal();
  }

  createBookmarkFAB(toggleButton: Element): void {
    const button = createBookmarkButton(toggleButton);
    button.addEventListener("click", () => this.openModal());
    console.log("⭐ Mr.WPlace: Favorite button added");
  }

  createSaveButton(container: Element): void {
    const button = createSaveBookmarkButton(container);
    button.addEventListener("click", () => this.addBookmark());
    console.log("⭐ Mr.WPlace: Save button added");
  }

  createModal(): void {
    const modalElements = createBookmarkModal();
    const modal = modalElements.modal;

    modal
      .querySelector("#wps-favorites-grid")!
      .addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const card = target.closest(".wps-favorite-card") as HTMLElement | null;
        const deleteBtn = target.closest(
          ".wps-delete-btn"
        ) as HTMLElement | null;

        if (deleteBtn?.dataset.id) {
          const id = parseInt(deleteBtn.dataset.id);
          this.deleteBookmarks(id);
        } else if (
          card?.dataset.lat &&
          card?.dataset.lng &&
          card?.dataset.zoom
        ) {
          const lat = parseFloat(card.dataset.lat);
          const lng = parseFloat(card.dataset.lng);
          const zoom = parseFloat(card.dataset.zoom);
          await gotoPosition({ lat, lng, zoom });
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
          this.renderBookmarks();
        }
      });
  }

  openModal(): void {
    this.renderBookmarks();
    (
      document.getElementById(
        "wplace-studio-favorite-modal"
      ) as HTMLDialogElement
    ).showModal();
  }

  async addBookmark(): Promise<void> {
    const position = getCurrentPosition();
    if (!position) {
      alert(t`${"location_unavailable_instruction"}`);
      return;
    }

    const name = await showNameInputModal(
      t`${"enter_bookmark_name"}`,
      t`${"location_point"} (${position.lat.toFixed(3)}, ${position.lng.toFixed(
        3
      )})`
    );
    if (name === null) return;
    const bookmarkName =
      name === ""
        ? `(${position.lat.toFixed(3)}, ${position.lng.toFixed(3)})`
        : name;

    const favorite = {
      id: Date.now(),
      name: bookmarkName,
      lat: position.lat,
      lng: position.lng,
      zoom: position.zoom || 14,
      date: formatDateShort(new Date()),
    };

    await BookmarkStorage.addBookmark(favorite);

    Toast.success(t`"${name}" ${"saved_message"}`);
  }

  async renderBookmarks(): Promise<void> {
    const favorites = await BookmarkStorage.getBookmarks();
    renderBookmarks(favorites);
  }

  async deleteBookmarks(id: number): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;

    const favorites = await BookmarkStorage.getBookmarks();
    await BookmarkStorage.removeBookmark(id);

    this.renderBookmarks();
    Toast.success(t`${"deleted_message"}`);
  }
}
