import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import { storage } from "@/utils/browser-api";
import { Toast } from "@/components/toast";
import {
  findOpacityContainer,
  findPositionModal,
  findMapPin,
} from "@/constants/selectors";
import { addMapPinButton } from "@/utils/map-pin-helper";
import { BookmarkStorage } from "./storage";
import { ImportExportService } from "./import-export";
import { getCurrentPosition, gotoPosition } from "@/utils/position";
import { showNameInputModal } from "@/components/modal";
import { t, formatDateShort } from "@/i18n/manager";
import {
  createBookmarkButton,
  createBookmarkModal,
  createSaveBookmarkButton,
  renderBookmarks,
  BookmarkSortType,
} from "./ui";
import { BookmarkRouter } from "./router";
import { renderCoordinateJumper } from "./routes/coordinate-jumper";
import type { BookmarkAPI } from "@/core/di";
import { Tutorial } from "@/features/tutorial";
// import { IMG_ICON_BOOKMARK } from "@/assets/iconImages";

const SORT_KEY = "wplace-studio-bookmark-sort";

let router: BookmarkRouter;
let selectedTagFilters: Set<string> = new Set();
let tutorial: Tutorial;

class TagSelectionState {
  private color: string = "";
  private name: string = "";

  setTag(color: string, name: string = ""): void {
    this.color = color;
    this.name = name;
  }

  clearTag(): void {
    this.color = "";
    this.name = "";
  }

  getTag(): { color: string; name: string } | undefined {
    return this.color ? { color: this.color, name: this.name } : undefined;
  }

  hasTag(): boolean {
    return !!this.color;
  }
}

let tagState: TagSelectionState;

const render = async (): Promise<void> => {
  const result = await storage.get([SORT_KEY]);
  const sortType = result[SORT_KEY] || "created";
  const favorites = await BookmarkStorage.getBookmarks();
  const existingTags = await BookmarkStorage.getExistingTags();

  // Render tag filters
  const { renderTagFilters } = await import("./ui");
  renderTagFilters(
    existingTags,
    favorites,
    selectedTagFilters,
    (tagKey: string) => {
      if (selectedTagFilters.has(tagKey)) {
        selectedTagFilters.delete(tagKey);
      } else {
        selectedTagFilters.add(tagKey);
      }
      render();
    }
  );

  renderBookmarks(favorites, sortType, selectedTagFilters);
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
};

const openModal = (): void => {
  setupModal();
  router.initialize("list");
  (
    document.getElementById("wplace-studio-favorite-modal") as HTMLDialogElement
  ).showModal();
};

const editBookmark = async (id: number): Promise<void> => {
  const bookmarks = await BookmarkStorage.getBookmarks();
  const bookmark = bookmarks.find((b) => b.id === id);
  if (!bookmark) return;

  const { showEditScreen } = await import("./ui");
  showEditScreen(bookmark);
};

const renderCurrentRoute = async (route: string): Promise<void> => {
  const screens = {
    list: document.getElementById("wps-bookmark-list-screen"),
    coordinateJumper: document.getElementById("wps-coordinate-jumper-screen"),
    locationSearch: document.getElementById("wps-location-search-screen"),
    edit: document.getElementById("wps-bookmark-edit-screen"),
  };

  if (!Object.values(screens).every((s) => s)) return;

  // Hide all screens
  Object.values(screens).forEach((s) => (s!.style.display = "none"));

  // Show current route
  switch (route) {
    case "list":
      screens.list!.style.display = "flex";
      render();
      break;
    case "coordinate-jumper":
      screens.coordinateJumper!.style.display = "block";
      renderCoordinateJumper(screens.coordinateJumper!);
      break;
    case "location-search":
      screens.locationSearch!.style.display = "block";
      const { renderLocationSearch } = await import("./routes/location-search");
      renderLocationSearch(screens.locationSearch!);
      break;
  }
};

const setupNavigationHandlers = (
  modal: HTMLDialogElement,
  backButton: HTMLElement
): void => {
  backButton.addEventListener("click", () => router.navigateBack());

  modal
    .querySelector("#wps-coordinate-jumper-btn")!
    .addEventListener("click", () => router.navigate("coordinate-jumper"));

  modal
    .querySelector("#wps-location-search-btn")!
    .addEventListener("click", () => router.navigate("location-search"));
};

const setupBookmarkListHandlers = (modal: HTMLDialogElement): void => {
  modal
    .querySelector("#wps-favorites-grid")!
    .addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const card = target.closest(".wps-card") as HTMLElement | null;
      const deleteBtn = target.closest(".wps-delete-btn") as HTMLElement | null;
      const editBtn = target.closest(".wps-edit-btn") as HTMLElement | null;

      if (deleteBtn?.dataset.id) {
        deleteBookmark(parseInt(deleteBtn.dataset.id));
      } else if (editBtn?.dataset.id) {
        editBookmark(parseInt(editBtn.dataset.id));
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
    .querySelector("#wps-import-export-btn")!
    .addEventListener("click", async () => {
      const { showImportExportDialog } = await import("./ui");
      showImportExportDialog(
        async () => {
          const result = await ImportExportService.importFavorites();
          Toast.success(result.message);
          if (result.shouldRender) render();
        },
        async () => {
          const result = await ImportExportService.exportFavorites();
          Toast.success(result.message);
        },
        async (tags) => {
          const result = await ImportExportService.exportFavoritesByTags(tags);
          Toast.success(result.message);
        }
      );
    });

  modal
    .querySelector("#wps-bookmark-sort")!
    .addEventListener("change", async (e) => {
      const sortType = (e.target as HTMLSelectElement)
        .value as BookmarkSortType;
      await storage.set({ [SORT_KEY]: sortType });
      render();
    });
};

const setupEditScreenHandlers = (modal: HTMLDialogElement): void => {
  modal
    .querySelector("#wps-edit-cancel")!
    .addEventListener("click", async () => {
      const { hideEditScreen } = await import("./ui");
      hideEditScreen();
    });

  modal.querySelector("#wps-edit-save")!.addEventListener("click", async () => {
    const nameInput = document.getElementById(
      "wps-edit-name"
    ) as HTMLInputElement;
    const creationDiv = document.getElementById("wps-edit-tag-creation");
    const editScreen = document.getElementById("wps-bookmark-edit-screen");

    if (!editScreen?.dataset.bookmarkId || !nameInput) return;

    const bookmarkId = parseInt(editScreen.dataset.bookmarkId);
    const bookmarks = await BookmarkStorage.getBookmarks();
    const bookmark = bookmarks.find((b) => b.id === bookmarkId);

    if (!bookmark) return;

    const newName = nameInput.value.trim();
    if (!newName) {
      Toast.error(t`${"bookmark_name"} ${"required"}`);
      return;
    }

    bookmark.name = newName;

    const isCreatingNewTag = creationDiv?.style.display === "block";

    if (isCreatingNewTag) {
      const tagNameInput = document.getElementById(
        "wps-edit-tag-name"
      ) as HTMLInputElement;
      const selectedColorBtn = document.querySelector(
        ".wps-color-btn[style*='border: 3px solid rgb(0, 0, 0)']"
      ) as HTMLElement;

      const tagName = tagNameInput?.value.trim();
      const tagColor = selectedColorBtn?.dataset.color;

      if (!tagColor) {
        Toast.error(t`${"tag_color"} ${"required"}`);
        return;
      }

      bookmark.tag = { color: tagColor, name: tagName || undefined };
    } else {
      bookmark.tag = tagState.getTag();
    }

    await BookmarkStorage.updateBookmark(bookmark);

    const { hideEditScreen } = await import("./ui");
    hideEditScreen();
    render();
  });
};

const setupTagSelectionHandlers = (modal: HTMLDialogElement): void => {
  modal
    .querySelector("#wps-existing-tags-container")!
    .addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;

      const editBtn = target.closest(".wps-tag-edit-btn") as HTMLElement | null;
      if (editBtn) {
        e.stopPropagation();

        const color = editBtn.dataset.color!;
        const name = editBtn.dataset.name || "";
        const tag: import("./types").Tag = { color, name: name || undefined };

        const { showTagEditModal } = await import("./ui");

        showTagEditModal(
          tag,
          async (oldTag, newTag) => {
            await BookmarkStorage.updateTag(oldTag, newTag);
            const editScreen = document.getElementById(
              "wps-bookmark-edit-screen"
            );
            if (editScreen?.style.display === "block") {
              const { showEditScreen } = await import("./ui");
              const bookmarkId = parseInt(editScreen.dataset.bookmarkId!);
              const bookmarks = await BookmarkStorage.getBookmarks();
              const bookmark = bookmarks.find((b) => b.id === bookmarkId);
              if (bookmark) showEditScreen(bookmark);
            }
            render();
          },
          async (tagToDelete) => {
            if (!confirm(t`${"tag_delete_confirm"}`)) return;

            await BookmarkStorage.deleteTag(tagToDelete);
            Toast.success(t`${"deleted_message"}`);

            const editScreen = document.getElementById(
              "wps-bookmark-edit-screen"
            );
            if (editScreen?.style.display === "block") {
              const { showEditScreen } = await import("./ui");
              const bookmarkId = parseInt(editScreen.dataset.bookmarkId!);
              const bookmarks = await BookmarkStorage.getBookmarks();
              const bookmark = bookmarks.find((b) => b.id === bookmarkId);
              if (bookmark) showEditScreen(bookmark);
            }
            render();
          }
        );

        return;
      }

      const clickableArea = target.closest(
        ".wps-tag-item-clickable"
      ) as HTMLElement | null;
      if (!clickableArea) return;

      const tagItem = clickableArea.closest(
        ".wps-existing-tag-item"
      ) as HTMLElement | null;
      if (!tagItem) return;

      const color = tagItem.dataset.color!;
      const name = tagItem.dataset.name || "";

      tagState.setTag(color, name);

      const existingTags = await BookmarkStorage.getExistingTags();
      const { renderExistingTags } = await import("./ui");
      renderExistingTags(existingTags, { color, name: name || undefined });
    });

  modal
    .querySelector("#wps-new-tag-btn")!
    .addEventListener("click", async () => {
      const { showTagCreation } = await import("./ui");
      showTagCreation();
    });

  modal
    .querySelector("#wps-no-tag-btn")!
    .addEventListener("click", async () => {
      tagState.clearTag();

      const existingTags = await BookmarkStorage.getExistingTags();
      const { renderExistingTags } = await import("./ui");
      renderExistingTags(existingTags, undefined);
    });

  modal.querySelector("#wps-tag-back")!.addEventListener("click", async () => {
    const { showTagSelection } = await import("./ui");
    showTagSelection();
  });
};

const setupColorPickerHandlers = (modal: HTMLDialogElement): void => {
  modal.querySelector("#wps-color-picker")!.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const colorBtn = target.closest(".wps-color-btn") as HTMLElement | null;

    if (!colorBtn) return;

    document.querySelectorAll(".wps-color-btn").forEach((btn) => {
      (btn as HTMLElement).style.border = "3px solid transparent";
    });

    colorBtn.style.border = "3px solid #000";
  });
};

const setupModal = (): void => {
  const modalElements = createBookmarkModal();
  const { modal, container } = modalElements;

  tagState = new TagSelectionState();
  tutorial = new Tutorial();

  router = new BookmarkRouter();
  router.setHeaderElements(
    modalElements.titleElement,
    modalElements.backButton
  );
  router.setOnRouteChange(renderCurrentRoute);

  setupNavigationHandlers(modal, modalElements.backButton);
  setupBookmarkListHandlers(modal);
  setupEditScreenHandlers(modal);
  setupTagSelectionHandlers(modal);
  setupColorPickerHandlers(modal);

  // Add tutorial button to modal
  tutorial.createButton(container);
};

const createMapPinButtons = (container: Element): void => {
  addMapPinButton(container, {
    id: "bookmark-btn",
    icon: "⭐",
    text: t`${"save_location"}`,
    onClick: () => addBookmark(),
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
    // 優先: マップピン周辺にボタン配置
    {
      id: "bookmark-map-pin-btn",
      getTargetElement: findMapPin,
      createElement: createMapPinButtons,
    },
    // フォールバック: position modalにボタン配置
    {
      id: "save-btn-fallback",
      getTargetElement: findPositionModal,
      createElement: (positionModal) => {
        // マップピングループが既に存在する場合はスキップ
        if (document.querySelector("#map-pin-button-group")) return;

        const saveButton = createSaveBookmarkButton();
        saveButton.id = "save-btn-fallback";
        saveButton.addEventListener("click", addBookmark);
        positionModal.prepend(saveButton);
        console.log("🧑‍🎨 : Fallback button created in position modal");
      },
    },
  ];
  setupElementObserver(buttonConfigs);
  // setupModal は openModal で呼ばれるようになったので、ここでは呼ばない
  console.log("🧑‍🎨 : Bookmark initialized");
};

export const bookmarkAPI: BookmarkAPI = {
  initBookmark: init,
};
