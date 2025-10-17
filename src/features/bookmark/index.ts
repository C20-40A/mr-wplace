import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
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
import type { BookmarkAPI } from "../../core/di";

const SORT_KEY = "wplace-studio-bookmark-sort";

const render = async (): Promise<void> => {
  const sortType = await new Promise<BookmarkSortType>((resolve) => {
    chrome.storage.local.get([SORT_KEY], (result) => {
      resolve(result[SORT_KEY] || "created");
    });
  });
  const favorites = await BookmarkStorage.getBookmarks();
  renderBookmarks(favorites, sortType);
  const sortSelect = document.getElementById(
    "wps-bookmark-sort"
  ) as HTMLSelectElement;
  if (sortSelect) sortSelect.value = sortType;
};

const deleteBookmark = async (id: number): Promise<void> => {
  if (!confirm(t`${"delete_confirm"}`)) return;
  await BookmarkStorage.removeBookmark(id);
  render();
  Toast.success(t`${"deleted_message"}`);
};

const addBookmark = async (): Promise<void> => {
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

  await BookmarkStorage.addBookmark({
    id: Date.now(),
    name: bookmarkName,
    lat: position.lat,
    lng: position.lng,
    zoom: position.zoom || 14,
    date: formatDateShort(new Date()),
  });
  Toast.success(t`"${name}" ${"saved_message"}`);
};

const openModal = (): void => {
  render();
  (
    document.getElementById("wplace-studio-favorite-modal") as HTMLDialogElement
  ).showModal();
};

const setupModal = (): void => {
  const { modal } = createBookmarkModal();

  modal
    .querySelector("#wps-favorites-grid")!
    .addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const card = target.closest(".wps-card") as HTMLElement | null;
      const deleteBtn = target.closest(".wps-delete-btn") as HTMLElement | null;

      if (deleteBtn?.dataset.id) {
        deleteBookmark(parseInt(deleteBtn.dataset.id));
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
        await gotoPosition({
          lat: parseFloat(card.dataset.lat),
          lng: parseFloat(card.dataset.lng),
          zoom: parseFloat(card.dataset.zoom),
        });
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
      if (result.shouldRender) render();
    });

  modal
    .querySelector("#wps-bookmark-sort")!
    .addEventListener("change", async (e) => {
      const sortType = (e.target as HTMLSelectElement)
        .value as BookmarkSortType;
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ [SORT_KEY]: sortType }, resolve);
      });
      render();
    });
};

const init = (): void => {
  const buttonConfigs: ElementConfig[] = [
    {
      id: "bookmarks-btn",
      getTargetElement: findOpacityContainer,
      createElement: (container) => {
        const button = createBookmarkButton();
        button.id = "bookmarks-btn";
        button.addEventListener("click", openModal);
        container.className += " flex flex-col-reverse gap-1";
        container.appendChild(button);
      },
    },
    {
      id: "save-btn",
      getTargetElement: findPositionModal,
      createElement: (positionModal) => {
        const saveButton = createSaveBookmarkButton();
        saveButton.id = "save-btn";
        saveButton.addEventListener("click", addBookmark);
        positionModal.prepend(saveButton);
      },
    },
  ];
  setupElementObserver(buttonConfigs);
  setupModal();
  console.log("🧑‍🎨 : Bookmark initialized");
};

export const bookmarkAPI: BookmarkAPI = {
  initBookmark: init,
};
