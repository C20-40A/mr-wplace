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
} from "./ui";

export class ExtendedBookmarks {
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

    await BookmarkStorage.removeBookmark(id);

    this.renderBookmarks();
    Toast.success(t`${"deleted_message"}`);
  }
}
