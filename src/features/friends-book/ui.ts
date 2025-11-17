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
export const showAddFriendDialog = async (userData: {
  id: number;
  name: string;
  equippedFlag: number;
  allianceId?: number;
  allianceName?: string;
  picture?: string;
}): Promise<void> => {
  return new Promise((resolve) => {
    // 既に友人リストに存在するかチェック
    FriendsBookStorage.getFriendById(userData.id).then((existingFriend) => {
      const isExisting = !!existingFriend;

      const modal = document.createElement("dialog");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-box" style="max-width: 24rem;">
          <h3 class="font-bold text-base mb-3">
            ${isExisting ? t`edit_friend` : t`add_friend`}
          </h3>

          <!-- ユーザー情報表示 -->
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

          <!-- タグ選択エリア -->
          <div class="mb-3">
            <label class="label py-1">
              <span class="label-text text-xs">${t`tag`}</span>
            </label>
            <div id="tag-selection-area"></div>
          </div>

          <!-- 説明入力 -->
          <div class="mb-3">
            <label class="label py-1">
              <span class="label-text text-xs">${t`description`}</span>
            </label>
            <input
              id="friend-memo-input"
              type="text"
              class="input input-bordered input-sm w-full text-xs"
              placeholder="${t`description_placeholder`}"
              value="${existingFriend?.memo || ""}"
            />
          </div>

          <div class="modal-action mt-3">
            <button id="cancel-btn" class="btn btn-sm">${t`cancel`}</button>
            <button id="save-friend-btn" class="btn btn-sm btn-primary">
              ${isExisting ? t`update` : t`add`}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="button" id="backdrop-btn">close</button>
        </form>
      `;

      document.body.appendChild(modal);

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

        tagSelectionArea.innerHTML = `
          <div class="flex flex-wrap gap-1 mb-1">
            ${existingTags
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
                <span class="text-xs">${tag.name || t`tag`}</span>
              </button>
            `
              )
              .join("")}
          </div>
          <button id="new-tag-btn" class="btn btn-xs btn-ghost">+ ${t`new_tag`}</button>
          ${
            selectedTag
              ? `<button id="clear-tag-btn" class="btn btn-xs btn-ghost ml-1">${t`clear_tag`}</button>`
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

        const memo = memoInput.value.trim();

        const friend: Friend = {
          id: userData.id,
          name: userData.name,
          equippedFlag: userData.equippedFlag,
          allianceId: userData.allianceId,
          allianceName: userData.allianceName,
          picture: userData.picture,
          memo: memo || undefined,
          tag: selectedTag,
          addedDate: existingFriend?.addedDate || Date.now(),
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
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 20rem;">
        <h3 class="font-bold text-base mb-3">${t`create_new_tag`}</h3>

        <div class="mb-3">
          <label class="label py-1">
            <span class="label-text text-xs">${t`tag_name_placeholder`}</span>
          </label>
          <input
            id="tag-name-input"
            type="text"
            class="input input-sm input-bordered w-full text-xs"
            placeholder="${t`tag_name_placeholder`}"
          />
        </div>

        <div class="mb-3">
          <label class="label py-1">
            <span class="label-text text-xs">${t`select_color`}</span>
          </label>
          <div class="flex flex-wrap gap-1.5" id="color-picker">
            ${TAG_COLORS.map(
              (color, i) => `
              <button
                class="color-btn w-6 h-6 rounded-full ${
                  i === 0 ? "ring-2 ring-offset-1 ring-black" : ""
                }"
                data-color="${color}"
                style="background: ${color};"
              ></button>
            `
            ).join("")}
          </div>
        </div>

        <div class="modal-action mt-3">
          <button id="cancel-btn" class="btn btn-sm">${t`cancel`}</button>
          <button id="save-tag-btn" class="btn btn-sm btn-primary">${t`create`}</button>
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

    // カラーボタンのイベント
    colorPicker.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        colorPicker.querySelectorAll(".color-btn").forEach((b) => {
          b.className = "color-btn w-6 h-6 rounded-full";
        });
        btn.className =
          "color-btn w-6 h-6 rounded-full ring-2 ring-offset-1 ring-black";
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
  const sortedFriends = [...filteredFriends].sort((a, b) => {
    switch (sortType) {
      case "name":
        return a.name.localeCompare(b.name);
      case "tag": {
        const tagA = a.tag ? `${a.tag.name || ""}${a.tag.color}` : "zzz";
        const tagB = b.tag ? `${b.tag.name || ""}${b.tag.color}` : "zzz";
        return tagA.localeCompare(tagB);
      }
      case "added":
      default:
        return b.addedDate - a.addedDate;
    }
  });

  if (sortedFriends.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #999;">
        <p>${t`no_friends`}</p>
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
              <div class="text-xs opacity-80 mb-1 truncate" title="${friend.memo.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}">
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
