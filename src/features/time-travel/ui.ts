import { t } from "../../i18n/manager";

export const createTimeTravelButton = (container: Element): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-neutral btn-soft mx-3";
  button.setAttribute("data-wplace-timetravel", "true");
  button.innerHTML = t`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
      </svg>
      ${"timetravel"}
    `;

  // Drawing流用：既存の子要素の前に挿入
  const firstChild = container.firstElementChild;
  if (firstChild) {
    container.insertBefore(button, firstChild);
  } else {
    container.appendChild(button);
  }
  return button;
};

export const createTimeTravelModal = (): HTMLDialogElement => {
  const modal = document.createElement("dialog");
  modal.id = "wplace-studio-timetravel-modal";
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box w-11/12 max-w-md">
      <h3 class="font-bold text-lg mb-4">${"timetravel_modal_title"}</h3>
      
      <!-- スナップショット一覧 -->
      <div class="max-h-60 overflow-y-auto border rounded p-2 mb-4">
        <div id="wps-timetravel-list">
          <div class="text-sm text-gray-500 text-center p-4">${"loading"}</div>
        </div>
      </div>
      
      <!-- 保存ボタン -->
      <div class="flex gap-2">
        <button id="wps-save-snapshot-btn" class="btn btn-primary flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
            <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
          </svg>
          ${"save_current_snapshot"}
        </button>
        <button class="btn btn-ghost" onclick="this.closest('dialog').close()">${"close"}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  return modal;
};

// ダウンロード用Modal（image-detail流用）
export const createSnapshotDownloadModal = (): HTMLDialogElement => {
  const modal = document.createElement("dialog");
  modal.id = "wplace-studio-snapshot-download-modal";
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box w-11/12 max-w-4xl">
      <h3 class="font-bold text-lg mb-4">${"snapshot_download_title"}</h3>
      
      <!-- 画像表示（image-detail流用） -->
      <div class="flex flex-col items-center justify-center mb-4">
        <div class="flex items-center justify-center" style="max-height: 70vh; max-width: 90vw;">
          <img id="wps-snapshot-image" src="" alt="Snapshot" class="" style="image-rendering: pixelated; min-width: 50vw; max-width: 90vw; max-height: 70vh; object-fit: contain; aspect-ratio: auto;">
        </div>
      </div>
      
      <!-- ダウンロードボタン -->
      <div class="flex gap-2 justify-center">
        <button id="wps-download-snapshot-btn" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path fill-rule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06L11.25 14.69V3a.75.75 0 01.75-.75z" clip-rule="evenodd" />
            <path fill-rule="evenodd" d="M6.75 15.75a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
          </svg>
          ${"download"}
        </button>
        <button class="btn btn-ghost" onclick="this.closest('dialog').close()">${"close"}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  return modal;
};
