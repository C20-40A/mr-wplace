import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import {
  showAddFriendDialog,
  createFriendsBookModal,
  renderFriends,
  renderFriendsTagFilters,
  showImportExportDialog,
  FriendsSortType,
} from "./ui";
import { FriendsBookStorage } from "./storage";
import { Toast } from "@/components/toast";
import { storage } from "@/utils/browser-api";
import { t } from "@/i18n/manager";
import { IMG_ICON_BOOK } from "@/assets/iconImages";
import { friendsToCSV, csvToFriends, downloadCSV } from "./csv-utils";
import { Tag } from "./types";
import { findPositionModal } from "@/constants/selectors";

/**
 * "Painted by:" 要素を検索
 */
const findPaintedByContainer = (): Element | null => {
  const positionModal = findPositionModal();
  if (!positionModal) return null;

  // モーダル内の .px-3.pb-1.5 要素を検索
  const container = positionModal.querySelector(".px-3.pb-1\\.5");
  if (container) return container;

  // Fallback: flex items-center gap-2 の親要素
  const flexContainer = positionModal.querySelector(
    ".flex.items-center.gap-2",
  )?.parentElement;
  return flexContainer || null;
};

// 最後に受信したユーザー情報を保存
let lastPaintedByUser: {
  id: number;
  name: string;
  equippedFlag: number;
  allianceId?: number;
  allianceName?: string;
  picture?: string;
} | null = null;

/**
 * "Painted by:" をタグに置き換え、友人帳に追加ボタンを作成
 */
const createAddToFriendsButton = async (container: Element): Promise<void> => {
  // 既にボタンが存在する場合はスキップ
  if (container.querySelector("#add-to-friends-btn")) {
    return;
  }

  const button = document.createElement("button");
  button.id = "add-to-friends-btn";
  button.className = "btn btn-xs btn-circle ml-1";
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
      <path d="M720-400v-120H600v-80h120v-120h80v120h120v80H800v120h-80Zm-360-80q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm80-80h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0-80Zm0 400Z"/>
    </svg>
  `;
  button.title = t`${"add_to_friends"}`;

  button.addEventListener("click", async () => {
    if (!lastPaintedByUser) {
      Toast.error(t`location_unavailable`);
      return;
    }

    await showAddFriendDialog(lastPaintedByUser);
  });

  // ボタンを "..." ボタンの前に挿入（兄弟要素として）
  // .flex.items-center.gap-2 の中の .dropdown の前に配置
  const flexContainer = container.querySelector(".flex.items-center.gap-2");
  const moreButton = flexContainer?.querySelector(".dropdown");

  if (moreButton && flexContainer) {
    flexContainer.insertBefore(button, moreButton);
  } else {
    // fallback: flex container の最後に追加
    if (flexContainer) {
      flexContainer.appendChild(button);
    } else {
      container.appendChild(button);
    }
  }

  // "Painted by:" をタグに置き換え、メモをtooltipで表示
  if (lastPaintedByUser) {
    const friend = await FriendsBookStorage.getFriendById(lastPaintedByUser.id);

    // タグがあれば "Painted by:" を置き換え
    if (friend?.tag) {
      const paintedBySpan = container.querySelector("span");
      if (
        paintedBySpan &&
        (paintedBySpan.textContent === "Painted by:" ||
          paintedBySpan.textContent === "Pintado por:")
      ) {
        const tagBadge = document.createElement("div");
        tagBadge.className = "badge badge-sm gap-1";
        tagBadge.style.cssText = `background: ${friend.tag.color}20; border-color: ${friend.tag.color};`;
        tagBadge.innerHTML = `
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${
            friend.tag.color
          };"></div>
          ${friend.tag.name || t`tag`}
        `;
        paintedBySpan.replaceWith(tagBadge);
      }
    }

    // 説明があれば名前にtooltipを追加
    if (friend?.memo || friend?.tag) {
      // ユーザー名要素を探す: IDを含むspan
      const userNameSpan = (
        Array.from(container.querySelectorAll("span")) as HTMLElement[]
      ).find(
        (span) =>
          span.textContent?.includes(`#${lastPaintedByUser?.id}`) &&
          !span.querySelector("span"), // Get the innermost span
      );

      if (userNameSpan) {
        // The tooltip should be on the parent element, which contains both name and ID
        const targetElement = userNameSpan.parentElement;
        if (!targetElement) return;

        targetElement.classList.add("tooltip");

        const tagText = friend.tag ? `[${friend.tag.name || t`tag`}]` : "";
        const memoText = friend.memo || "";
        const tooltipText = `${tagText} ${memoText}`.trim();

        if (tooltipText) {
          targetElement.setAttribute("data-tip", tooltipText);
        }
      }
    }
  }

  console.log("🧑‍🎨 : Add to friends button created");
};

/**
 * 友人帳FABボタンを作成（画面右上）
 */
const createFriendsBookFAB = (): void => {
  if (document.querySelector("#friends-book-fab")) return;

  const button = document.createElement("button");
  button.id = "friends-book-fab";
  button.className = "btn btn-square shadow-md top-2";
  button.style.cssText =
    "position: absolute; right: 60px; z-index: 800; transition: transform 0.2s;";
  button.innerHTML = `
    <img src="${IMG_ICON_BOOK}" style="width: calc(var(--spacing)*7); height: calc(var(--spacing)*7); image-rendering: pixelated;" />
  `;
  button.title = t`friends_book`;

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
  });

  button.addEventListener("click", openModal);

  document.body.appendChild(button);
  console.log("🧑‍🎨 : Friends book FAB created");
};

const SORT_KEY = "friends-book-sort";
let selectedTagFilters: Set<string> = new Set();

/**
 * 友人リストをレンダリング
 */
const render = async (): Promise<void> => {
  const result = await storage.get([SORT_KEY]);
  const sortType = result[SORT_KEY] || "added";
  const friends = await FriendsBookStorage.getFriends();
  const existingTags = await FriendsBookStorage.getExistingTags();

  renderFriendsTagFilters(
    existingTags,
    friends,
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

  renderFriends(friends, sortType, selectedTagFilters);

  const sortSelect = document.getElementById(
    "friends-sort",
  ) as HTMLSelectElement;
  if (sortSelect) sortSelect.value = sortType;
};

/**
 * 友人を削除
 */
const deleteFriend = async (id: number): Promise<void> => {
  if (!confirm(t`delete_confirm`)) return;
  await FriendsBookStorage.removeFriend(id);
  render();
  Toast.success(t`deleted_message`);
};

/**
 * 友人を編集
 */
const editFriend = async (id: number): Promise<void> => {
  const friends = await FriendsBookStorage.getFriends();
  const friend = friends.find((f) => f.id === id);
  if (!friend) return;

  await showAddFriendDialog({
    id: friend.id,
    name: friend.name,
    equippedFlag: friend.equippedFlag,
    allianceId: friend.allianceId,
    allianceName: friend.allianceName,
    picture: friend.picture,
  });

  render();
};

/**
 * モーダルを開く
 */
const openModal = (): void => {
  setupModal();
  render();
  const modal = document.getElementById(
    "friends-book-modal",
  ) as HTMLDialogElement;
  if (modal) modal.showModal();
};

/**
 * CSVをインポート
 */
const handleImport = async (csv: string): Promise<void> => {
  try {
    const friends = csvToFriends(csv);

    if (friends.length === 0) {
      Toast.error(t`import_failed`);
      return;
    }

    // 統合モードで確認
    const existingFriends = await FriendsBookStorage.getFriends();
    const message =
      existingFriends.length > 0
        ? t`${
            friends.length
          } ${`import_merge_confirm`}\n${`import_merge_description`}`
        : t`${friends.length} ${`import_confirm`}`;

    if (!confirm(message)) return;

    const mode = existingFriends.length > 0 ? "merge" : "replace";
    await FriendsBookStorage.importFriends(friends, mode);
    render();
    Toast.success(t`${friends.length} ${`import_success`}`);
  } catch (error) {
    console.error("🧑‍🎨 : Import failed", error);
    Toast.error(t`import_failed`);
  }
};

/**
 * 全友人をエクスポート
 */
const handleExport = async (): Promise<void> => {
  const friends = await FriendsBookStorage.getFriends();
  if (friends.length === 0) {
    Toast.error(t`no_friends`);
    return;
  }

  const csv = friendsToCSV(friends);
  const timestamp = new Date().toISOString().split("T")[0];
  downloadCSV(csv, `wplace-friends-${timestamp}.csv`);
  Toast.success(t`${friends.length} ${`export_success`}`);
};

/**
 * タグ別エクスポート
 */
const handleExportByTag = async (tags: Tag[]): Promise<void> => {
  const friends = await FriendsBookStorage.exportFriendsByTags(tags);
  if (friends.length === 0) {
    Toast.error(t`no_friends`);
    return;
  }

  const csv = friendsToCSV(friends);
  const timestamp = new Date().toISOString().split("T")[0];
  const tagNames = tags.map((t) => t.name || "tag").join("-");
  downloadCSV(csv, `wplace-friends-${tagNames}-${timestamp}.csv`);
  Toast.success(t`${friends.length} ${`export_success`}`);
};

/**
 * モーダルをセットアップ
 */
const setupModal = (): void => {
  const { modal } = createFriendsBookModal();

  // ソート変更
  modal
    .querySelector("#friends-sort")!
    .addEventListener("change", async (e) => {
      const sortType = (e.target as HTMLSelectElement).value as FriendsSortType;
      await storage.set({ [SORT_KEY]: sortType });
      render();
    });

  // 友人追加ボタン
  modal
    .querySelector("#friends-add-btn")
    ?.addEventListener("click", async () => {
      await showAddFriendDialog();
      render();
    });

  // Import/Export ボタン
  modal
    .querySelector("#friends-import-export-btn")
    ?.addEventListener("click", () => {
      showImportExportDialog(handleImport, handleExport, handleExportByTag);
    });

  // カードクリック（編集・削除）
  modal.querySelector("#friends-grid")!.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const editBtn = target.closest(".friends-edit-btn") as HTMLElement | null;
    const deleteBtn = target.closest(
      ".friends-delete-btn",
    ) as HTMLElement | null;

    if (editBtn?.dataset.id) {
      editFriend(parseInt(editBtn.dataset.id));
    } else if (deleteBtn?.dataset.id) {
      deleteFriend(parseInt(deleteBtn.dataset.id));
    }
  });

  console.log("🧑‍🎨 : Friends book modal setup complete");
};

const init = (): void => {
  const buttonConfigs: ElementConfig[] = [
    {
      id: "add-to-friends-btn",
      getTargetElement: findPaintedByContainer,
      createElement: createAddToFriendsButton,
    },
  ];

  setupElementObserver(buttonConfigs);
  // setupModal は openModal で呼ばれるようになったので、ここでは呼ばない

  // FABボタンを画面右上に配置
  createFriendsBookFAB();

  // Listen for painted by user data from inject
  window.addEventListener("message", (event) => {
    if (event.data.source === "mr-wplace-painted-by-user") {
      lastPaintedByUser = {
        id: event.data.userData.id,
        name: event.data.userData.name,
        equippedFlag: event.data.userData.equippedFlag || 0,
        allianceId: event.data.userData.allianceId,
        allianceName: event.data.userData.allianceName,
        picture: event.data.userData.picture,
      };
      console.log("🧑‍🎨 : Received painted by user data:", lastPaintedByUser);
    }
  });

  console.log("🧑‍🎨 : Friends book initialized");
};

export const friendsBookAPI = {
  initFriendsBook: init,
};
