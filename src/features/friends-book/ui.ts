import { Friend, Tag } from "./types";
import { FriendsBookStorage } from "./storage";
import { t } from "@/i18n/manager";
import { createModal, ModalElements } from "@/components/modal";
import { minidenticon } from "@/utils/miniidenticon";

const TAG_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#d946ef",
  "#f43f5e",
];

/**
 * 友人追加ダイアログを表示
 */
export const showAddFriendDialog = async (userData?: {
  id: number;
  name: string;
  equippedFlag: number;
  allianceId?: number;
  allianceName?: string;
  picture?: string;
}): Promise<void> => {
  return new Promise((resolve) => {
    // 既に友人リストに存在するかチェック
    const checkPromise = userData
      ? FriendsBookStorage.getFriendById(userData.id)
      : Promise.resolve(null);

    checkPromise.then((existingFriend) => {
      const isExisting = !!existingFriend;
      const isNewMode = !userData; // 新規追加モード

      const modal = document.createElement("dialog");
      modal.className = "modal";
      modal.innerHTML = t`
        <div class="modal-box" style="max-width: 24rem;">
          <h3 class="font-bold text-base mb-3">
            ${isExisting ? `edit_friend` : `add_friend`}
          </h3>

          <!-- ID/名前入力 (新規追加モードまたは編集モード) -->
          ${
            isNewMode || isExisting
              ? t`
          <div class="mb-3">
            <label class="label py-1">
              <span class="label-text text-xs">${"user_id"}</span>
            </label>
            <input
              id="friend-id-input"
              type="number"
              class="input input-bordered input-sm w-full text-xs"
              placeholder="${"user_id_placeholder"}"
              value="${userData?.id || ""}"
              ${!isNewMode ? "" : ""}
            />
          </div>
          <div class="mb-3">
            <label class="label py-1">
              <span class="label-text text-xs">${"user_name"}</span>
            </label>
            <input
              id="friend-name-input"
              type="text"
              class="input input-bordered input-sm w-full text-xs"
              placeholder="${"user_name_placeholder"}"
              value="${userData?.name || ""}"
            />
          </div>
          `
              : t`
          <!-- ユーザー情報表示 (新規追加ではない場合) -->
          <div class="bg-base-200 rounded-lg p-2 mb-3">
            <div class="flex items-center gap-2">
              <span class="font-medium text-red-500 text-sm">${
                userData.name
              }</span>
              <span class="text-xs opacity-70">#${userData.id}</span>
            </div>
            ${
              userData.allianceName
                ? `<div class="text-xs opacity-70 mt-0.5">${userData.allianceName}</div>`
                : ""
            }
          </div>
          `
          }

          <!-- タグ選択エリア -->
          <div class="mb-3">
            <label class="label py-1">
              <span class="label-text text-xs">${`tag`}</span>
            </label>
            <div id="tag-selection-area"></div>
          </div>

          <!-- 説明入力 -->
          <div class="mb-3">
            <label class="label py-1">
              <span class="label-text text-xs">${`description`}</span>
            </label>
            <input
              id="friend-memo-input"
              type="text"
              class="input input-bordered input-sm w-full text-xs"
              placeholder="${`description_placeholder`}"
              value="${existingFriend?.memo || ""}"
            />
          </div>

          <div class="modal-action mt-3">
            <button id="cancel-btn" class="btn btn-sm">${`cancel`}</button>
            <button id="save-friend-btn" class="btn btn-sm btn-primary">
              ${isExisting ? `update` : `add`}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="button" id="backdrop-btn">close</button>
        </form>
      `;

      document.body.appendChild(modal);

      const idInput = modal.querySelector(
        "#friend-id-input"
      ) as HTMLInputElement | null;
      const nameInput = modal.querySelector(
        "#friend-name-input"
      ) as HTMLInputElement | null;
      const memoInput = modal.querySelector(
        "#friend-memo-input"
      ) as HTMLInputElement;
      const saveBtn = modal.querySelector(
        "#save-friend-btn"
      ) as HTMLButtonElement;
      const cancelBtn = modal.querySelector("#cancel-btn") as HTMLButtonElement;
      const backdropBtn = modal.querySelector(
        "#backdrop-btn"
      ) as HTMLButtonElement;
      const tagSelectionArea = modal.querySelector(
        "#tag-selection-area"
      ) as HTMLElement;

      let selectedTag: Tag | undefined = existingFriend?.tag;

      // タグ選択UIをレンダリング
      const renderTagSelection = async () => {
        const existingTags = await FriendsBookStorage.getExistingTags();

        // 選択中のタグが既存タグリストにない場合は追加（新規作成タグ用）
        const isNewTag =
          selectedTag &&
          !existingTags.some(
            (tag) =>
              tag.color === selectedTag?.color && tag.name === selectedTag.name
          );
        const displayTags =
          isNewTag && selectedTag
            ? [...existingTags, selectedTag]
            : existingTags;

        tagSelectionArea.innerHTML = t`
          <div class="flex flex-wrap gap-1 mb-1">
            ${displayTags
              .map(
                (tag) => `
              <button
                class="tag-btn btn btn-xs ${
                  selectedTag?.color === tag.color &&
                  selectedTag?.name === tag.name
                    ? "btn-primary"
                    : "btn-outline"
                }"
                data-color="${tag.color}"
                data-name="${tag.name || ""}"
                style="border-color: ${tag.color};"
              >
                <span style="width: 8px; height: 8px; background: ${
                  tag.color
                }; border-radius: 50%; display: inline-block;"></span>
                <span class="text-xs">${tag.name || `tag`}</span>
              </button>
            `
              )
              .join("")}
          </div>
          <button id="new-tag-btn" class="btn btn-xs btn-ghost">+ ${"new_tag"}</button>
          ${
            selectedTag
              ? t`<button id="clear-tag-btn" class="btn btn-xs btn-ghost ml-1">${"clear_tag"}</button>`
              : ""
          }
        `;

        // タグボタンのイベント
        tagSelectionArea.querySelectorAll(".tag-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const color = (btn as HTMLElement).dataset.color!;
            const name = (btn as HTMLElement).dataset.name || undefined;
            selectedTag = { color, name };
            renderTagSelection();
          });
        });

        // 新しいタグボタン
        const newTagBtn = tagSelectionArea.querySelector("#new-tag-btn");
        newTagBtn?.addEventListener("click", async () => {
          const newTag = await showNewTagDialog();
          if (newTag) {
            selectedTag = newTag;
            await renderTagSelection(); // 再レンダリングして新しいタグを反映
          }
        });

        // タグクリアボタン
        const clearTagBtn = tagSelectionArea.querySelector("#clear-tag-btn");
        clearTagBtn?.addEventListener("click", () => {
          selectedTag = undefined;
          renderTagSelection();
        });
      };

      renderTagSelection();

      let resolved = false;

      const handleSave = async () => {
        if (resolved) return;
        resolved = true;

        // ID/名前の取得（入力フィールドがある場合はそちらを優先）
        const friendId = idInput
          ? parseInt(idInput.value.trim())
          : userData?.id || 0;
        const friendName = nameInput
          ? nameInput.value.trim()
          : userData?.name || "";

        if (!friendId || !friendName) {
          alert(t`please_enter_id_and_name`);
          resolved = false;
          return;
        }

        const memo = memoInput.value.trim();

        const friend: Friend = {
          id: friendId,
          name: friendName,
          equippedFlag: userData?.equippedFlag || 0,
          allianceId: userData?.allianceId,
          allianceName: userData?.allianceName,
          picture: userData?.picture,
          memo: memo || undefined,
          tag: selectedTag,
        };

        if (isExisting) {
          await FriendsBookStorage.updateFriend(friend);
        } else {
          await FriendsBookStorage.addFriend(friend);
        }

        modal.close();
        resolve();
      };

      const handleCancel = () => {
        if (resolved) return;
        resolved = true;
        modal.close();
        resolve();
      };

      saveBtn.addEventListener("click", handleSave);
      cancelBtn.addEventListener("click", handleCancel);
      backdropBtn.addEventListener("click", handleCancel);

      modal.addEventListener("close", () => {
        console.log("🧑‍🎨 : Add friend dialog closed, cleaning up...");
        saveBtn.removeEventListener("click", handleSave);
        cancelBtn.removeEventListener("click", handleCancel);
        backdropBtn.removeEventListener("click", handleCancel);
        modal.remove();

        if (!resolved) {
          resolved = true;
          resolve();
        }
      });

      modal.showModal();
    });
  });
};

/**
 * 新しいタグ作成ダイアログ
 */
const showNewTagDialog = (): Promise<Tag | null> => {
  return new Promise((resolve) => {
    const modal = document.createElement("dialog");
    modal.className = "modal";
    modal.innerHTML = t`
      <div class="modal-box" style="max-width: 20rem;">
        <h3 class="font-bold text-base mb-3">${`create_new_tag`}</h3>

        <div class="mb-3">
          <label class="label py-1">
            <span class="label-text text-xs">${`tag_name_placeholder`}</span>
          </label>
          <input
            id="tag-name-input"
            type="text"
            class="input input-sm input-bordered w-full text-xs"
            placeholder="${`tag_name_placeholder`}"
          />
        </div>

        <div class="mb-3">
          <label class="label py-1">
            <span class="label-text text-xs">${`select_color`}</span>
          </label>
          <div class="flex flex-wrap gap-1.5" id="color-picker"></div>
        </div>

        <div class="modal-action mt-3">
          <button id="cancel-btn" class="btn btn-sm">${`cancel`}</button>
          <button id="save-tag-btn" class="btn btn-sm btn-primary">${`create`}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" id="backdrop-btn">close</button>
      </form>
    `;

    document.body.appendChild(modal);

    const tagNameInput = modal.querySelector(
      "#tag-name-input"
    ) as HTMLInputElement;
    const colorPicker = modal.querySelector("#color-picker") as HTMLElement;
    const saveBtn = modal.querySelector("#save-tag-btn") as HTMLButtonElement;
    const cancelBtn = modal.querySelector("#cancel-btn") as HTMLButtonElement;
    const backdropBtn = modal.querySelector(
      "#backdrop-btn"
    ) as HTMLButtonElement;

    let selectedColor = TAG_COLORS[0];

    // カラーボタンを動的にレンダリング
    colorPicker.innerHTML = TAG_COLORS.map(
      (color, i) => `
        <button
          class="color-btn rounded-full ${
            i === 0 ? "ring-2 ring-offset-1 ring-black" : ""
          }"
          data-color="${color}"
          style="background: ${color}; width: 1.5rem; height: 1.5rem; flex-shrink: 0;"
        ></button>
      `
    ).join("");

    // カラーボタンのイベント
    colorPicker.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        colorPicker.querySelectorAll(".color-btn").forEach((b) => {
          b.className = "color-btn rounded-full";
        });
        btn.className =
          "color-btn rounded-full ring-2 ring-offset-1 ring-black";
        selectedColor = (btn as HTMLElement).dataset.color!;
      });
    });

    let resolved = false;

    const handleSave = () => {
      if (resolved) return;
      resolved = true;

      const name = tagNameInput.value.trim() || undefined;
      modal.close();
      resolve({ color: selectedColor, name });
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      modal.close();
      resolve(null);
    };

    saveBtn.addEventListener("click", handleSave);
    cancelBtn.addEventListener("click", handleCancel);
    backdropBtn.addEventListener("click", handleCancel);

    modal.addEventListener("close", () => {
      console.log("🧑‍🎨 : New tag dialog closed, cleaning up...");
      saveBtn.removeEventListener("click", handleSave);
      cancelBtn.removeEventListener("click", handleCancel);
      backdropBtn.removeEventListener("click", handleCancel);
      modal.remove();

      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });

    modal.showModal();
  });
};

/**
 * 友人帳モーダルを作成
 */
export const createFriendsBookModal = (): ModalElements => {
  const modalElements = createModal({
    id: "friends-book-modal",
    title: t`friends_book`,
    maxWidth: "64rem",
    containerStyle: "min-height: 35rem;",
  });

  modalElements.container.style.display = "flex";
  modalElements.container.style.flexDirection = "column";
  modalElements.container.style.height = "40rem";

  modalElements.container.innerHTML = t`
    <!-- Friends List Screen -->
    <div id="friends-list-screen" style="display: flex; flex-direction: column; height: 100%;">
      <!-- Fixed Header: Sort & Filters -->
      <div class="flex gap-2" style="flex-wrap: wrap; margin-bottom: 0.7rem; flex-shrink: 0;">
        <button id="friends-add-btn" class="btn btn-primary btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M720-400v-120H600v-80h120v-120h80v120h120v80H800v120h-80Zm-360-80q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm80-80h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T440-640q0-33-23.5-56.5T360-720q-33 0-56.5 23.5T280-640q0 33 23.5 56.5T360-560Zm0-80Zm0 400Z"/>
          </svg>
          ${"add_friend"}
        </button>
        <button id="friends-import-export-btn" class="btn btn-outline btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M440-367v-465l-64 64-56-57 160-160 160 160-56 57-64-64v465h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
          </svg>
          ${"import_export"}
        </button>
        <div class="flex items-center gap-2">
          <select id="friends-sort" class="select select-sm select-bordered">
            <option value="added">${`sort_added`}</option>
            <option value="name">${`sort_name`}</option>
            <option value="tag">${`sort_tag`}</option>
          </select>
        </div>
      </div>

      <!-- Tag Filter -->
      <div id="friends-tag-filter-container" style="margin-bottom: 0.7rem; flex-shrink: 0; display: none;">
        <div style="overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; white-space: nowrap; padding-bottom: 0.25rem;">
          <div id="friends-tag-filter-buttons" style="display: inline-flex; gap: 0.5rem;"></div>
        </div>
      </div>

      <!-- Scrollable Content: Friends Grid -->
      <div style="flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
        <div id="friends-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2">
        </div>
      </div>
    </div>
  `;

  return modalElements;
};

export type FriendsSortType = "added" | "name" | "tag";

/**
 * 友人リストをレンダリング
 */
export const renderFriends = (
  friends: Friend[],
  sortType: FriendsSortType,
  selectedTagFilters: Set<string>
): void => {
  const grid = document.getElementById("friends-grid");
  if (!grid) return;

  // タグフィルター適用
  let filteredFriends = friends;
  if (selectedTagFilters.size > 0) {
    filteredFriends = friends.filter((friend) => {
      if (!friend.tag) return false;
      const tagKey = `${friend.tag.color}-${friend.tag.name || ""}`;
      return selectedTagFilters.has(tagKey);
    });
  }

  // ソート
  let sortedFriends: Friend[];
  if (sortType === "added") {
    // 配列順 = 追加順（新しいものほど末尾）なので、逆順にして新しい順に表示
    sortedFriends = [...filteredFriends].reverse();
  } else {
    sortedFriends = [...filteredFriends].sort((a, b) => {
      switch (sortType) {
        case "name":
          return a.name.localeCompare(b.name);
        case "tag": {
          const tagA = a.tag ? `${a.tag.name || ""}${a.tag.color}` : "zzz";
          const tagB = b.tag ? `${b.tag.name || ""}${b.tag.color}` : "zzz";
          return tagA.localeCompare(tagB);
        }
        default:
          return 0;
      }
    });
  }

  if (sortedFriends.length === 0) {
    grid.innerHTML = t`
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #999;">
        <p>${`no_friends`}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = sortedFriends
    .map((friend) => {
      let avatarImage: string;
      if (friend.picture) {
        avatarImage = `<img src="${friend.picture}" class="rounded-full w-8 h-8" style="image-rendering: pixelated;" />`;
      } else {
        const svg = minidenticon(friend.id.toString());
        avatarImage = `<div class="rounded-full w-8 h-8 overflow-hidden">${svg}</div>`;
      }

      return `
        <div class="friends-card card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
             data-id="${friend.id}">
          <div class="card-body p-2">
            <!-- User Info -->
            <div class="flex items-center gap-2 mb-1">
              <div class="avatar flex-shrink-0">
                ${avatarImage}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-sm truncate">${friend.name}</h3>
                <p class="text-xs opacity-70">#${friend.id}${
        friend.allianceName ? ` · ${friend.allianceName}` : ""
      }</p>
              </div>
            </div>

            <!-- Description -->
            ${
              friend.memo
                ? `
              <div class="text-xs opacity-80 mb-1 truncate" title="${friend.memo
                .replace(/"/g, "&quot;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")}">
                ${friend.memo.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
              </div>
            `
                : `<div class="text-xs mb-1" style="height: 1.25rem;"></div>`
            }

            <!-- Tag & Actions -->
            <div class="flex items-center justify-between gap-1">
              ${
                friend.tag
                  ? `
                <div class="badge badge-sm gap-1" style="background: ${
                  friend.tag.color
                }20; border-color: ${friend.tag.color};">
                  <div style="width: 6px; height: 6px; border-radius: 50%; background: ${
                    friend.tag.color
                  };"></div>
                  <span class="text-xs">${friend.tag.name || t`tag`}</span>
                </div>
              `
                  : `<div></div>`
              }
              <div class="flex gap-1">
                <button class="friends-edit-btn btn btn-ghost btn-xs" data-id="${
                  friend.id
                }">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                    <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                  </svg>
                </button>
                <button class="friends-delete-btn btn btn-ghost btn-xs text-error" data-id="${
                  friend.id
                }">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                    <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};

/**
 * タグフィルターをレンダリング
 */
export const renderFriendsTagFilters = (
  existingTags: Tag[],
  friends: Friend[],
  selectedTagFilters: Set<string>,
  onTagClick: (tagKey: string) => void
): void => {
  const container = document.getElementById("friends-tag-filter-container");
  const buttonsContainer = document.getElementById(
    "friends-tag-filter-buttons"
  );

  if (!container || !buttonsContainer) return;

  if (existingTags.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";

  // タグごとの友人数をカウント
  const tagCounts = new Map<string, number>();
  for (const friend of friends) {
    if (friend.tag) {
      const tagKey = `${friend.tag.color}-${friend.tag.name || ""}`;
      tagCounts.set(tagKey, (tagCounts.get(tagKey) || 0) + 1);
    }
  }

  buttonsContainer.innerHTML = existingTags
    .map((tag) => {
      const tagKey = `${tag.color}-${tag.name || ""}`;
      const count = tagCounts.get(tagKey) || 0;
      const isSelected = selectedTagFilters.has(tagKey);

      return `
        <button
          class="friends-tag-filter-btn btn btn-sm ${
            isSelected ? "btn-primary" : "btn-outline"
          }"
          data-tag-key="${tagKey}"
          style="border-color: ${tag.color}; ${
        isSelected
          ? `background: ${tag.color}; border-color: ${tag.color};`
          : ""
      }"
        >
          <span style="width: 12px; height: 12px; background: ${
            tag.color
          }; border-radius: 50%; display: inline-block;"></span>
          ${tag.name || t`tag`} (${count})
        </button>
      `;
    })
    .join("");

  // イベントリスナー
  buttonsContainer
    .querySelectorAll(".friends-tag-filter-btn")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const tagKey = (btn as HTMLElement).dataset.tagKey!;
        onTagClick(tagKey);
      });
    });
};

/**
 * Import/Export ダイアログを表示
 */
export const showImportExportDialog = async (
  onImport: (csv: string) => Promise<void>,
  onExport: () => void,
  onExportByTag: (tags: Tag[]) => void
): Promise<void> => {
  const allFriends = await FriendsBookStorage.getFriends();
  const existingTags = await FriendsBookStorage.getExistingTags();
  const savedSyncUrl = await FriendsBookStorage.getSyncUrl();

  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-4">${`import_export`}</h3>

      <!-- Online Sync Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${`online_sync`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${`online_sync_description`}</p>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input id="friends-sync-url-input" type="text" placeholder="https://docs.google.com/spreadsheets/..."
            value="${savedSyncUrl}" class="input input-sm input-bordered" style="flex: 1; font-size: 0.75rem;" />
          <button id="friends-sync-url-open-btn" class="btn btn-sm btn-ghost btn-square" title="${`open_url`}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/>
            </svg>
          </button>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="friends-sync-merge-btn" class="btn btn-primary btn-sm" style="flex: 1;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-40-343 237-137-237-137-237 137 237 137ZM160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11L160-252Z"/>
            </svg>
            ${`sync_merge`}
          </button>
          <button id="friends-sync-replace-btn" class="btn btn-outline btn-sm" style="flex: 1;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h357l-80 80H200v560h560v-278l80-80v358q0 33-23.5 56.5T760-120H200Zm280-360ZM360-360v-170l367-367q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L530-360H360Zm481-424-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"/>
            </svg>
            ${`sync_replace`}
          </button>
        </div>
      </div>

      <!-- Import Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${`import`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${`import_friends_description`}</p>
        <button id="friends-dialog-import-btn" class="btn btn-primary btn-sm w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Z"/>
          </svg>
          ${`import`} (CSV)
        </button>
      </div>

      <!-- Export Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${`export`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${`export_all_friends_description`}</p>
        <button id="friends-dialog-export-all-btn" class="btn btn-primary btn-sm w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
          </svg>
          ${`export_all`} (${allFriends.length})
        </button>
      </div>

      <!-- Export by Tag Section -->
      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${`export_by_tag`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${`export_friends_by_tag_description`}</p>
        ${
          existingTags.length === 0
            ? t`<p style="text-align: center; color: oklch(var(--bc) / 0.4); padding: 1rem;">${`no_tags_available`}</p>`
            : t`
              <div id="friends-export-tag-list" style="max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; margin-bottom: 0.75rem;">
                ${existingTags
                  .map((tag) => {
                    const count = allFriends.filter(
                      (f) =>
                        f.tag &&
                        f.tag.color === tag.color &&
                        (f.tag.name || "") === (tag.name || "")
                    ).length;
                    return t`
                      <label class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200" style="margin-bottom: 0.25rem;">
                        <input type="checkbox" class="checkbox checkbox-sm friends-tag-checkbox" data-color="${
                          tag.color
                        }" data-name="${tag.name || ""}" />
                        <div style="width: 20px; height: 20px; border-radius: 4px; background: ${
                          tag.color
                        }; flex-shrink: 0;"></div>
                        <span style="flex: 1;">${tag.name || `no_name`}</span>
                        <span style="font-size: 0.75rem; color: oklch(var(--bc) / 0.6);">(${count})</span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
              <button id="friends-dialog-export-tag-btn" class="btn btn-primary btn-sm w-full" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                  <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
                </svg>
                ${`export_selected_tags`}
              </button>
            `
        }
      </div>

      <!-- Close Button -->
      <div class="modal-action">
        <button id="friends-dialog-close-btn" class="btn btn-outline btn-sm">${`close`}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  // Import button
  modal
    .querySelector("#friends-dialog-import-btn")
    ?.addEventListener("click", async () => {
      modal.close();
      modal.remove();

      try {
        const { selectCSVFile } = await import("./csv-utils");
        const csv = await selectCSVFile();
        await onImport(csv);
      } catch (error) {
        console.error("🧑‍🎨 : Import failed", error);
      }
    });

  // Export all button
  modal
    .querySelector("#friends-dialog-export-all-btn")
    ?.addEventListener("click", () => {
      modal.close();
      modal.remove();
      onExport();
    });

  // Tag checkbox handler
  const updateExportTagButton = () => {
    const checkboxes = modal.querySelectorAll(".friends-tag-checkbox:checked");
    const exportTagBtn = modal.querySelector(
      "#friends-dialog-export-tag-btn"
    ) as HTMLButtonElement;
    if (exportTagBtn) {
      exportTagBtn.disabled = checkboxes.length === 0;
    }
  };

  modal.querySelectorAll(".friends-tag-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", updateExportTagButton);
  });

  // Export by tag button
  modal
    .querySelector("#friends-dialog-export-tag-btn")
    ?.addEventListener("click", () => {
      const selectedTags: Tag[] = [];
      modal
        .querySelectorAll(".friends-tag-checkbox:checked")
        .forEach((checkbox) => {
          const el = checkbox as HTMLInputElement;
          selectedTags.push({
            color: el.dataset.color!,
            name: el.dataset.name || undefined,
          });
        });
      modal.close();
      modal.remove();
      onExportByTag(selectedTags);
    });

  // Sync URL input - save on change
  const syncUrlInput = modal.querySelector(
    "#friends-sync-url-input"
  ) as HTMLInputElement;
  syncUrlInput?.addEventListener("blur", async () => {
    const url = syncUrlInput.value.trim();
    await FriendsBookStorage.setSyncUrl(url);
  });

  // Open URL button
  modal
    .querySelector("#friends-sync-url-open-btn")
    ?.addEventListener("click", () => {
      const url = syncUrlInput?.value.trim();
      if (url) {
        window.open(url, "_blank");
      }
    });

  // Merge sync button
  modal
    .querySelector("#friends-sync-merge-btn")
    ?.addEventListener("click", async () => {
      const url = syncUrlInput?.value.trim();
      if (!url) {
        alert(t`${"please_enter_sync_url"}`);
        return;
      }

      modal.close();
      modal.remove();

      try {
        const { fetchCSVFromUrl } = await import("./csv-utils");
        const csv = await fetchCSVFromUrl(url);
        await onImport(csv);
      } catch (error) {
        console.error("🧑‍🎨 : Sync merge failed", error);
        alert(t`${"sync_failed"}` + ": " + (error as Error).message);
      }
    });

  // Replace sync button
  modal
    .querySelector("#friends-sync-replace-btn")
    ?.addEventListener("click", async () => {
      const url = syncUrlInput?.value.trim();
      if (!url) {
        alert(t`${"please_enter_sync_url"}`);
        return;
      }

      const confirmed = confirm(t`${"sync_replace_confirm"}`);
      if (!confirmed) return;

      modal.close();
      modal.remove();

      try {
        const { fetchCSVFromUrl, csvToFriends } = await import("./csv-utils");
        const csv = await fetchCSVFromUrl(url);
        const friends = csvToFriends(csv);
        await FriendsBookStorage.importFriends(friends, "replace");
        location.reload();
      } catch (error) {
        console.error("🧑‍🎨 : Sync replace failed", error);
        alert(t`${"sync_failed"}` + ": " + (error as Error).message);
      }
    });

  // Close button
  modal
    .querySelector("#friends-dialog-close-btn")
    ?.addEventListener("click", () => {
      modal.close();
      modal.remove();
    });

  // Close on backdrop click
  modal.addEventListener("close", () => {
    modal.remove();
  });
};
