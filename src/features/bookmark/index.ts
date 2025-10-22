import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import { storage } from "@/utils/browser-api";
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
import { BookmarkRouter } from "./router";
import { renderCoordinateJumper } from "./routes/coordinate-jumper";
import type { BookmarkAPI } from "../../core/di";

const SORT_KEY = "wplace-studio-bookmark-sort";

let router: BookmarkRouter;

const render = async (): Promise<void> => {
  const result = await storage.get([SORT_KEY]);
  const sortType = result[SORT_KEY] || "created";
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
  const listScreen = document.getElementById("wps-bookmark-list-screen");
  const coordinateJumperScreen = document.getElementById("wps-coordinate-jumper-screen");
  const locationSearchScreen = document.getElementById("wps-location-search-screen");
  const editScreen = document.getElementById("wps-bookmark-edit-screen");

  if (!listScreen || !coordinateJumperScreen || !locationSearchScreen || !editScreen) return;

  // Hide all screens
  listScreen.style.display = "none";
  coordinateJumperScreen.style.display = "none";
  locationSearchScreen.style.display = "none";
  editScreen.style.display = "none";

  // Show current route
  switch (route) {
    case "list":
      listScreen.style.display = "flex";
      render();
      break;
    case "coordinate-jumper":
      coordinateJumperScreen.style.display = "block";
      renderCoordinateJumper(coordinateJumperScreen);
      break;
    case "location-search":
      locationSearchScreen.style.display = "block";
      const { renderLocationSearch } = await import("./routes/location-search");
      renderLocationSearch(locationSearchScreen);
      break;
  }
};

const setupModal = (): void => {
  const modalElements = createBookmarkModal();
  const { modal } = modalElements;

  // Initialize router
  router = new BookmarkRouter();
  router.setHeaderElements(
    modalElements.titleElement,
    modalElements.backButton
  );
  router.setOnRouteChange(renderCurrentRoute);

  // Back button handler
  modalElements.backButton.addEventListener("click", () => {
    router.navigateBack();
  });

  // Coordinate Jumper button
  modal
    .querySelector("#wps-coordinate-jumper-btn")!
    .addEventListener("click", () => {
      router.navigate("coordinate-jumper");
    });

  // Location Search button
  modal
    .querySelector("#wps-location-search-btn")!
    .addEventListener("click", () => {
      router.navigate("location-search");
    });

  modal
    .querySelector("#wps-favorites-grid")!
    .addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
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
      await storage.set({ [SORT_KEY]: sortType });
      render();
    });

  // == Edit Screen Handlers ==

  // Cancel button
  modal
    .querySelector("#wps-edit-cancel")!
    .addEventListener("click", async () => {
      const { hideEditScreen } = await import("./ui");
      hideEditScreen();
    });

  // Existing tags selection
  modal
    .querySelector("#wps-existing-tags-container")!
    .addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const tagItem = target.closest(".wps-existing-tag-item") as HTMLElement | null;
      
      if (!tagItem) return;
      
      const editScreen = document.getElementById("wps-bookmark-edit-screen");
      if (!editScreen) return;
      
      const color = tagItem.dataset.color!;
      const name = tagItem.dataset.name || "";
      
      editScreen.dataset.currentTagColor = color;
      editScreen.dataset.currentTagName = name;
      
      // Visual feedback: highlight selected tag
      document.querySelectorAll(".wps-existing-tag-item").forEach((item) => {
        (item as HTMLElement).style.border = "2px solid transparent";
      });
      tagItem.style.border = "2px solid #000";
      
      console.log("🧑‍🎨 : Selected existing tag:", color, name);
    });

  // New tag button
  modal
    .querySelector("#wps-new-tag-btn")!
    .addEventListener("click", async () => {
      const { showTagCreation } = await import("./ui");
      showTagCreation();
    });

  // No tag button
  modal
    .querySelector("#wps-no-tag-btn")!
    .addEventListener("click", () => {
      const editScreen = document.getElementById("wps-bookmark-edit-screen");
      if (!editScreen) return;
      
      editScreen.dataset.currentTagColor = "";
      editScreen.dataset.currentTagName = "";
      
      // Visual feedback: deselect all tags
      document.querySelectorAll(".wps-existing-tag-item").forEach((item) => {
        (item as HTMLElement).style.border = "2px solid transparent";
      });
      
      console.log("🧑‍🎨 : Tag removed");
    });

  // Tag back button (step 2 -> step 1)
  modal
    .querySelector("#wps-tag-back")!
    .addEventListener("click", async () => {
      const { showTagSelection } = await import("./ui");
      showTagSelection();
    });

  // Color picker handler
  modal
    .querySelector("#wps-color-picker")!
    .addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const colorBtn = target.closest(".wps-color-btn") as HTMLElement | null;

      if (!colorBtn) return;

      // Remove selection from all buttons
      document.querySelectorAll(".wps-color-btn").forEach((btn) => {
        (btn as HTMLElement).style.border = "3px solid transparent";
      });

      // Add selection to clicked button
      colorBtn.style.border = "3px solid #000";
    });

  // Save button
  modal
    .querySelector("#wps-edit-save")!
    .addEventListener("click", async () => {
      const editScreen = document.getElementById("wps-bookmark-edit-screen");
      const nameInput = document.getElementById("wps-edit-name") as HTMLInputElement;
      const creationDiv = document.getElementById("wps-edit-tag-creation");

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
      
      // Tag handling
      const isCreatingNewTag = creationDiv?.style.display === "block";
      
      if (isCreatingNewTag) {
        // New tag creation: get from inputs
        const tagNameInput = document.getElementById("wps-edit-tag-name") as HTMLInputElement;
        const selectedColorBtn = document.querySelector(".wps-color-btn[style*='border: 3px solid rgb(0, 0, 0)']") as HTMLElement;
        
        const tagName = tagNameInput?.value.trim();
        const tagColor = selectedColorBtn?.dataset.color;
        
        if (tagColor) {
          bookmark.tag = {
            color: tagColor,
            name: tagName || undefined,
          };
        } else {
          Toast.error(t`${"tag_color"} ${"required"}`);
          return;
        }
      } else {
        // Existing tag or no tag: get from dataset
        const tagColor = editScreen.dataset.currentTagColor;
        const tagName = editScreen.dataset.currentTagName;
        
        if (tagColor) {
          bookmark.tag = {
            color: tagColor,
            name: tagName || undefined,
          };
        } else {
          bookmark.tag = undefined;
        }
      }

      await BookmarkStorage.updateBookmark(bookmark);
      Toast.success(t`${"saved_message"}`);

      const { hideEditScreen } = await import("./ui");
      hideEditScreen();
      render();
      
      console.log("🧑‍🎨 : Bookmark updated:", bookmark);
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
