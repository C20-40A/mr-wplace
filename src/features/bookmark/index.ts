import { setupElementObserver } from "../../components/element-observer";
import { Toast } from "../../components/toast";
import {
  findOpacityContainer,
  findPositionModal,
} from "../../constants/selectors";
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
  BookmarkSortType,
} from "./ui";

export class ExtendedBookmarks {
  private static readonly SORT_KEY = "wplace-studio-bookmark-sort";

  constructor() {
    setupElementObserver([
      {
        id: "bookmarks-btn",
        getTargetElement: findOpacityContainer,
        createElement: (container) => {
          const button = createBookmarkButton();
          button.id = "bookmarks-btn"; // 重複チェック用ID設定
          button.addEventListener("click", () => this.openModal());
          container.className += " flex flex-col-reverse gap-1"; // Add flex layout
          container.appendChild(button);
        },
      },
      {
        id: "save-btn",
        getTargetElement: findPositionModal,
        createElement: (positionModal) => {
          const saveButton = createSaveBookmarkButton();
          saveButton.id = "save-btn"; // 重複チェック用ID設定
          saveButton.addEventListener("click", () => this.addBookmark());
          positionModal.prepend(saveButton);
        },
      },
    ]);
    this.createModal();
  }

  private async getSortType(): Promise<BookmarkSortType> {
    return new Promise((resolve) => {
      chrome.storage.local.get([ExtendedBookmarks.SORT_KEY], (result) => {
        resolve(result[ExtendedBookmarks.SORT_KEY] || "created");
      });
    });
  }

  private async setSortType(sortType: BookmarkSortType): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        { [ExtendedBookmarks.SORT_KEY]: sortType },
        () => {
          resolve();
        }
      );
    });
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
          card?.dataset.zoom &&
          card?.dataset.id
        ) {
          const id = parseInt(card.dataset.id);
          const bookmarks = await BookmarkStorage.getBookmarks();
          const bookmark = bookmarks.find((b) => b.id === id);
          if (bookmark) {
            bookmark.lastAccessedDate = new Date().toISOString();
            await BookmarkStorage.updateBookmark(bookmark);
          }

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

    modal
      .querySelector("#wps-bookmark-sort")!
      .addEventListener("change", async (e) => {
        const sortType = (e.target as HTMLSelectElement)
          .value as BookmarkSortType;
        await this.setSortType(sortType);
        await this.renderBookmarks();
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
    const sortType = await this.getSortType();
    renderBookmarks(favorites, sortType);

    const sortSelect = document.getElementById(
      "wps-bookmark-sort"
    ) as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.value = sortType;
    }
  }

  async deleteBookmarks(id: number): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;

    await BookmarkStorage.removeBookmark(id);

    this.renderBookmarks();
    Toast.success(t`${"deleted_message"}`);
  }
}
