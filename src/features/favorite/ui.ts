import { Favorite } from "./types";

export class FavoriteUI {
  static createFavoriteButton(toggleButton: Element): HTMLButtonElement {
    const container = toggleButton.parentElement;
    if (!container) throw new Error("Container not found");

    // Add flex layout classes to container
    container.className += " flex flex-col-reverse gap-1";

    const button = document.createElement("button");
    button.className =
      "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
    button.title = "お気に入り";
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
        <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
      </svg>
    `;
    container.appendChild(button);
    return button;
  }

  static createSaveButton(container: Element): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "btn btn-neutral btn-soft mx-3";
    button.setAttribute("data-wplace-save", "true");
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4.5">
        <path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z"/>
      </svg>
      ブックマーク
    `;

    // 既存の子要素の前に挿入（先頭に表示）
    const firstChild = container.firstElementChild;
    if (firstChild) {
      container.insertBefore(button, firstChild);
    } else {
      container.appendChild(button);
    }
    return button;
  }

  static createDrawButton(container: Element): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "btn btn-neutral btn-soft mx-3";
    button.setAttribute("data-wplace-draw", "true");
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
        <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd"/>
      </svg>
      画像を描く
    `;

    // saveButtonの次に挿入（saveButtonが既にある場合）
    const saveButton = container.querySelector('[data-wplace-save="true"]');
    if (saveButton) {
      // saveButtonの後に挿入
      saveButton.insertAdjacentElement("afterend", button);
    } else {
      // saveButtonがない場合は先頭に挿入
      const firstChild = container.firstElementChild;
      if (firstChild) {
        container.insertBefore(button, firstChild);
      } else {
        container.appendChild(button);
      }
    }
    return button;
  }

  static createModal(): HTMLDialogElement {
    const modal = document.createElement("dialog");
    modal.id = "wplace-studio-favorite-modal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box max-w-4xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>

        <div class="flex items-center gap-1.5 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
            <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
          </svg>
          <h3 class="text-lg font-bold">WPlace Studio - お気に入り</h3>
        </div>

        <div class="flex gap-2 mb-4">
          <button id="wps-export-btn" class="btn btn-outline btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
            </svg>
            エクスポート
          </button>
          <button id="wps-import-btn" class="btn btn-outline btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Z"/>
            </svg>
            インポート
          </button>
          <input type="file" id="wps-import-file" accept=".json" style="display: none;">
        </div>

        <div id="wps-favorites-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
        </div>

        <div id="wps-favorites-count" class="text-center text-sm text-base-content/80 mt-4">
        </div>
      </div>

      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  static renderFavorites(favorites: Favorite[]): void {
    const grid = document.getElementById("wps-favorites-grid") as HTMLElement;
    const count = document.getElementById("wps-favorites-count") as HTMLElement;

    if (!grid || !count) return;

    count.textContent = `保存済み: ${favorites.length} 件`;

    if (favorites.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-12 mx-auto mb-4 text-base-content/50">
            <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/>
          </svg>
          <p class="text-base-content/80">お気に入りがありません</p>
          <p class="text-sm text-base-content/60">下の「保存」ボタンから追加してください</p>
        </div>
      `;
      return;
    }

    favorites.sort((a, b) => b.id - a.id);

    grid.innerHTML = favorites
      .map(
        (fav) => `
          <div class="wps-favorite-card card bg-base-200 shadow-sm hover:shadow-md cursor-pointer transition-all relative"
               data-lat="${fav.lat}" data-lng="${fav.lng}" data-zoom="${
          fav.zoom
        }">
            <button class="wps-delete-btn btn btn-ghost btn-xs btn-circle absolute right-1 top-1 z-10"
                    data-id="${fav.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
              </svg>
            </button>
            <div class="card-body p-3">
              <h4 class="card-title text-sm line-clamp-2">${fav.name}</h4>
              <div class="text-xs text-base-content/70 space-y-1">
                <div>📍 ${fav.lat.toFixed(3)}, ${fav.lng.toFixed(3)}</div>
                <div>📅 ${fav.date}</div>
              </div>
            </div>
          </div>
        `
      )
      .join("");
  }
}
