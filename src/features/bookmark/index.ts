import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import { storage } from "@/utils/browser-api";
import { Toast } from "@/components/toast";
import {
  findMyLocationContainer,
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
  renderBookmarks,
  renderFavoriteLocations,
  BookmarkSortType,
} from "./ui";
import type { OfficialFavoriteLocationsState } from "./ui";
import { BookmarkRouter } from "./router";
import { renderCoordinateJumper } from "./routes/coordinate-jumper";
import type { BookmarkAPI } from "@/core/di";
import { Tutorial } from "@/features/tutorial";
import { showFeatureHint } from "@/features/feature-hints";
import { TOOLBAR_ROW1_ID } from "@/features/position-info";
import type { FavoriteLocation } from "./types";

const SORT_KEY = "wplace-studio-bookmark-sort";
const TAB_KEY = "wplace-studio-bookmark-tab";

let router: BookmarkRouter;
let selectedTagFilters: Set<string> = new Set();
let tutorial: Tutorial;
let favoriteLocations: FavoriteLocation[] | null = null;
let favoriteLocationsTimeoutId: number | null = null;

const FAVORITE_LOCATIONS_TIMEOUT_MS = 4000;

const isOfficialFavoritesTabActive = (): boolean =>
  document.getElementById("wps-official-fav-tab-content")?.style.display ===
  "flex";

const clearFavoriteLocationsTimeout = (): void => {
  if (favoriteLocationsTimeoutId === null) return;
  window.clearTimeout(favoriteLocationsTimeoutId);
  favoriteLocationsTimeoutId = null;
};

const getOfficialFavoriteLocationsState = (): OfficialFavoriteLocationsState => {
  if (favoriteLocations !== null) {
    return {
      status: "ready",
      locations: favoriteLocations,
    };
  }

  return favoriteLocationsTimeoutId === null
    ? { status: "error" }
    : { status: "loading" };
};

const renderOfficialFavorites = (): void => {
  renderFavoriteLocations(getOfficialFavoriteLocationsState());
};

const requestOfficialFavoritesRecovery = (): void => {
  window.postMessage(
    {
      source: "mr-wplace-request-user-data",
      reason: "official-favorites",
    },
    "*",
  );
};

const scheduleOfficialFavoritesTimeout = (): void => {
  if (favoriteLocations !== null || favoriteLocationsTimeoutId !== null) return;

  favoriteLocationsTimeoutId = window.setTimeout(() => {
    favoriteLocationsTimeoutId = null;
    if (favoriteLocations === null && isOfficialFavoritesTabActive()) {
      renderOfficialFavorites();
    }
  }, FAVORITE_LOCATIONS_TIMEOUT_MS);
};

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
    },
  );

  renderBookmarks(favorites, sortType, selectedTagFilters);
  const sortSelect = document.getElementById(
    "wps-bookmark-sort",
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
      3,
    )})`,
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

const openModal = async (): Promise<void> => {
  setupModal();
  router.initialize("list");
  const saved = await storage.get([TAB_KEY]);
  const tab = saved[TAB_KEY] === "official-fav" ? "official-fav" : "bookmark";
  switchTab(tab, false);
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
  backButton: HTMLElement,
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
        },
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
      "wps-edit-name",
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
        "wps-edit-tag-name",
      ) as HTMLInputElement;
      const selectedColorBtn = document.querySelector(
        ".wps-color-btn[style*='border: 3px solid rgb(0, 0, 0)']",
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
              "wps-bookmark-edit-screen",
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
              "wps-bookmark-edit-screen",
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
        );

        return;
      }

      const clickableArea = target.closest(
        ".wps-tag-item-clickable",
      ) as HTMLElement | null;
      if (!clickableArea) return;

      const tagItem = clickableArea.closest(
        ".wps-existing-tag-item",
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

const switchTab = (tab: "bookmark" | "official-fav", persist = true): void => {
  const bookmarkTab = document.getElementById("wps-tab-bookmark");
  const officialFavTab = document.getElementById("wps-tab-official-fav");
  const bookmarkContent = document.getElementById("wps-bookmark-tab-content");
  const officialFavContent = document.getElementById("wps-official-fav-tab-content");
  if (!bookmarkTab || !officialFavTab || !bookmarkContent || !officialFavContent) return;
  if (persist) storage.set({ [TAB_KEY]: tab });

  const activeStyle =
    "border-radius: 0.9rem; border: 1px solid var(--color-primary); background: transparent; font-weight: 700; min-height: 3rem; padding: 0.75rem 0.9rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;";
  const inactiveStyle =
    "border-radius: 0.9rem; border: 1px solid transparent; background: transparent; font-weight: 500; min-height: 3rem; padding: 0.75rem 0.9rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;";

  if (tab === "bookmark") {
    bookmarkTab.style.cssText = activeStyle;
    officialFavTab.style.cssText = inactiveStyle;
    bookmarkTab.setAttribute("aria-pressed", "true");
    officialFavTab.setAttribute("aria-pressed", "false");
    bookmarkContent.style.display = "flex";
    officialFavContent.style.display = "none";
  } else {
    bookmarkTab.style.cssText = inactiveStyle;
    officialFavTab.style.cssText = activeStyle;
    bookmarkTab.setAttribute("aria-pressed", "false");
    officialFavTab.setAttribute("aria-pressed", "true");
    bookmarkContent.style.display = "none";
    officialFavContent.style.display = "flex";
    requestOfficialFavoritesRecovery();
    scheduleOfficialFavoritesTimeout();
    renderOfficialFavorites();
  }
};

const setupBottomTabHandlers = (modal: HTMLDialogElement): void => {
  modal
    .querySelector("#wps-tab-bookmark")!
    .addEventListener("click", () => switchTab("bookmark"));

  modal
    .querySelector("#wps-tab-official-fav")!
    .addEventListener("click", () => switchTab("official-fav"));

  // Official favorites grid click handler (jump only)
  modal
    .querySelector("#wps-official-fav-grid")!
    .addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const card = target.closest(".wps-card") as HTMLElement | null;
      if (card?.dataset.lat && card?.dataset.lng && card?.dataset.zoom) {
        await gotoPosition({
          lat: parseFloat(card.dataset.lat),
          lng: parseFloat(card.dataset.lng),
          zoom: parseFloat(card.dataset.zoom),
        });
        modal.close();
      }
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
    modalElements.backButton,
  );
  router.setOnRouteChange(renderCurrentRoute);

  setupNavigationHandlers(modal, modalElements.backButton);
  setupBookmarkListHandlers(modal);
  setupEditScreenHandlers(modal);
  setupTagSelectionHandlers(modal);
  setupColorPickerHandlers(modal);
  setupBottomTabHandlers(modal);

  // Add tutorial button next to the modal title in bookmark list
  tutorial.createButton(modalElements.titleElement.parentElement!, {
    placement: "inline",
  });
};

const createMapPinButtons = (container: Element): void => {
  const button = addMapPinButton(container, {
    id: "bookmark-btn",
    icon: "⭐",
    text: t`${"save_location"}`,
    onClick: () => addBookmark(),
  });

  if (button) showFeatureHint("bookmark-btn", button);
};

const findBookmarkButtonTarget = (): Element | null =>
  document.getElementById(TOOLBAR_ROW1_ID);

const init = (): void => {
  const buttonConfigs: ElementConfig[] = [
    {
      id: "bookmarks-btn",
      getTargetElement: findMyLocationContainer,
      createElement: (container) => {
        const button = createBookmarkButton();
        button.id = "bookmarks-btn";
        button.addEventListener("click", openModal);
        container.className += " flex flex-col-reverse gap-1";
        button.style.order = "1";
        container.appendChild(button);
        showFeatureHint("bookmarks-btn", button);
      },
    },
    // 優先: マップピン周辺にボタン配置
    {
      id: "bookmark-map-pin-btn",
      getTargetElement: findMapPin,
      createElement: createMapPinButtons,
    },
    // ツールバー1段目に配置
    {
      id: "save-btn-fallback",
      getTargetElement: findBookmarkButtonTarget,
      createElement: (row1) => {
        const btn = document.createElement("button");
        btn.id = "save-btn-fallback";
        btn.title = t`${"bookmark"}`;
        btn.className = "btn btn-xs btn-ghost";
        btn.style.cssText =
          "height: 1.25rem; min-height: 1.25rem; width: 1.25rem; min-width: 1.25rem; padding: 0;";
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z"/></svg>`;
        btn.addEventListener("click", addBookmark);
        row1.appendChild(btn);
      },
    },
  ];
  setupElementObserver(buttonConfigs);

  // Listen for favorite locations from inject (/me response)
  window.addEventListener("message", (e) => {
    if (e.data?.source === "mr-wplace-favorite-locations") {
      favoriteLocations = e.data.favoriteLocations || [];
      clearFavoriteLocationsTimeout();
      console.log("🧑‍🎨 : Favorite locations received:", favoriteLocations.length);
      if (isOfficialFavoritesTabActive()) renderOfficialFavorites();
    }
  });

  console.log("🧑‍🎨 : Bookmark initialized");
};

export const bookmarkAPI: BookmarkAPI = {
  initBookmark: init,
};
