import { Friend, Tag } from "./types";
import { FriendsBookStorage } from "./storage";
import { t } from "@/i18n/manager";
import { createModal, ModalElements } from "@/components/modal";
import { createCard, CardConfig } from "@/components/card";
import { minidenticon } from "@/utils/miniidenticon";

const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
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
        <div class="modal-box" style="max-width: 28rem;">
          <h3 class="font-bold text-lg mb-4">
            ${isExisting ? "友人を編集" : "友人帳に追加"}
          </h3>

          <!-- ユーザー情報表示 -->
          <div class="bg-base-200 rounded-lg p-3 mb-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="font-medium text-red-500">${userData.name}</span>
              <span class="text-sm opacity-70">#${userData.id}</span>
            </div>
            ${
              userData.allianceName
                ? `<div class="text-sm opacity-70">同盟: ${userData.allianceName}</div>`
                : ""
            }
          </div>

          <!-- タグ選択エリア -->
          <div class="mb-4">
            <label class="label">
              <span class="label-text">タグ</span>
            </label>
            <div id="tag-selection-area">
              <!-- タグ選択UI がここに挿入される -->
            </div>
          </div>

          <!-- メモ入力 -->
          <div class="mb-4">
            <label class="label">
              <span class="label-text">メモ</span>
            </label>
            <textarea
              id="friend-memo-input"
              class="textarea textarea-bordered w-full"
              placeholder="メモを入力..."
              rows="3"
            >${existingFriend?.memo || ""}</textarea>
          </div>

          <div class="modal-action">
            <button id="cancel-btn" class="btn">キャンセル</button>
            <button id="save-friend-btn" class="btn btn-primary">
              ${isExisting ? "更新" : "追加"}
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
      ) as HTMLTextAreaElement;
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
          <div class="flex flex-wrap gap-2 mb-2">
            ${existingTags
              .map(
                (tag) => `
              <button
                class="tag-btn btn btn-sm ${
                  selectedTag?.color === tag.color &&
                  selectedTag?.name === tag.name
                    ? "btn-primary"
                    : "btn-outline"
                }"
                data-color="${tag.color}"
                data-name="${tag.name || ""}"
                style="border-color: ${tag.color};"
              >
                <span style="width: 12px; height: 12px; background: ${
                  tag.color
                }; border-radius: 50%; display: inline-block;"></span>
                ${tag.name || "タグ"}
              </button>
            `
              )
              .join("")}
          </div>
          <button id="new-tag-btn" class="btn btn-sm btn-ghost">+ 新しいタグ</button>
          ${
            selectedTag
              ? '<button id="clear-tag-btn" class="btn btn-sm btn-ghost ml-2">タグをクリア</button>'
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
      <div class="modal-box" style="max-width: 24rem;">
        <h3 class="font-bold text-lg mb-4">新しいタグを作成</h3>

        <div class="mb-4">
          <label class="label">
            <span class="label-text">タグ名（オプション）</span>
          </label>
          <input
            id="tag-name-input"
            type="text"
            class="input input-bordered w-full"
            placeholder="例: 友達、ライバル、etc..."
          />
        </div>

        <div class="mb-4">
          <label class="label">
            <span class="label-text">色を選択</span>
          </label>
          <div class="flex flex-wrap gap-2" id="color-picker">
            ${TAG_COLORS.map(
              (color, i) => `
              <button
                class="color-btn w-8 h-8 rounded-full ${i === 0 ? "ring-2 ring-offset-2 ring-black" : ""}"
                data-color="${color}"
                style="background: ${color};"
              ></button>
            `
            ).join("")}
          </div>
        </div>

        <div class="modal-action">
          <button id="cancel-btn" class="btn">キャンセル</button>
          <button id="save-tag-btn" class="btn btn-primary">作成</button>
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
          b.className = "color-btn w-8 h-8 rounded-full";
        });
        btn.className = "color-btn w-8 h-8 rounded-full ring-2 ring-offset-2 ring-black";
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
    title: "友人帳",
    maxWidth: "64rem",
    containerStyle: "min-height: 35rem;",
  });

  modalElements.container.style.display = "flex";
  modalElements.container.style.flexDirection = "column";
  modalElements.container.style.height = "40rem";

  modalElements.container.innerHTML = `
    <!-- Friends List Screen -->
    <div id="friends-list-screen" style="display: flex; flex-direction: column; height: 100%;">
      <!-- Fixed Header: Sort & Filters -->
      <div class="flex gap-2" style="flex-wrap: wrap; margin-bottom: 0.7rem; flex-shrink: 0;">
        <div class="flex items-center gap-2">
          <select id="friends-sort" class="select select-sm select-bordered">
            <option value="added">追加順</option>
            <option value="name">名前順</option>
            <option value="tag">タグ順</option>
          </select>
        </div>
      </div>

      <!-- Tag Filter -->
      <div id="friends-tag-filter-container" style="margin-bottom: 0.7rem; flex-shrink: 0; display: none;">
        <div style="overflow-x: auto; overflow-y: hidden; white-space: nowrap; padding-bottom: 0.25rem;">
          <div id="friends-tag-filter-buttons" style="display: inline-flex; gap: 0.5rem;"></div>
        </div>
      </div>

      <!-- Scrollable Content: Friends Grid -->
      <div style="flex: 1; overflow-y: auto; min-height: 0;">
        <div id="friends-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
        <p>友人が登録されていません</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = sortedFriends
    .map((friend) => {
      let avatarImage: string;
      if (friend.picture) {
        avatarImage = `<img src="${friend.picture}" class="rounded-full w-10 h-10" />`;
      } else {
        // Generate minidenticon SVG using user ID
        const svg = minidenticon(friend.id.toString());
        avatarImage = `<div class="rounded-full w-10 h-10 overflow-hidden">${svg}</div>`;
      }

      const memoTooltip = friend.memo ? `title="${friend.memo.replace(/"/g, "&quot;")}"` : "";

      return `
        <div class="friends-card card bg-base-200 shadow-sm hover:shadow-md transition-shadow"
             data-id="${friend.id}">
          <div class="card-body p-3">
            <!-- User Info -->
            <div class="flex items-center gap-2">
              <div class="avatar">
                ${avatarImage}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base truncate" ${memoTooltip}>${friend.name}</h3>
                <p class="text-xs opacity-70">#${friend.id}${
          friend.allianceName ? ` · ${friend.allianceName}` : ""
        }</p>
              </div>
            </div>

            <!-- Tag -->
            ${
              friend.tag
                ? `
              <div class="mt-2">
                <div class="badge badge-sm gap-1" style="background: ${friend.tag.color}20; border-color: ${friend.tag.color};">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: ${friend.tag.color};"></div>
                  ${friend.tag.name || "タグ"}
                </div>
              </div>
            `
                : ""
            }

            <!-- Actions -->
            <div class="flex gap-1 justify-end mt-2">
              <button class="friends-edit-btn btn btn-ghost btn-xs" data-id="${friend.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                  <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
                </svg>
              </button>
              <button class="friends-delete-btn btn btn-ghost btn-xs text-error" data-id="${friend.id}">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                  <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
                </svg>
              </button>
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
  const buttonsContainer = document.getElementById("friends-tag-filter-buttons");

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
          class="friends-tag-filter-btn btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}"
          data-tag-key="${tagKey}"
          style="border-color: ${tag.color}; ${isSelected ? `background: ${tag.color}; border-color: ${tag.color};` : ""}"
        >
          <span style="width: 12px; height: 12px; background: ${tag.color}; border-radius: 50%; display: inline-block;"></span>
          ${tag.name || "タグ"} (${count})
        </button>
      `;
    })
    .join("");

  // イベントリスナー
  buttonsContainer.querySelectorAll(".friends-tag-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tagKey = (btn as HTMLElement).dataset.tagKey!;
      onTagClick(tagKey);
    });
  });
};
