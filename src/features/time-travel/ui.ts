import { t } from "../../i18n/manager";
import { TimeTravelRoute, TimeTravelRouter } from "./router";

// 元の位置に配置されるボタン（復元）
export const createTimeTravelButton = (
  container: Element
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-neutral btn-soft mx-3";
  button.style = "margin: 0.5rem;";
  button.setAttribute("data-wplace-timetravel", "true");
  button.innerHTML = t`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
      </svg>
      ${"timetravel"}
    `;

  // 既存の子要素の前に挿入（先頭に表示）
  const firstChild = container.firstElementChild;
  if (firstChild) {
    container.insertBefore(button, firstChild);
  } else {
    container.appendChild(button);
  }
  return button;
};

// 新しいFABボタン（丸い・SVGのみ）
export const createTimeTravelFAB = (container: Element): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "timetravel-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"timetravel"}`;
  button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
      </svg>
    `;
  
  const parentNode = container.parentNode;
  if (parentNode) {
    parentNode.className += " flex flex-col-reverse gap-1";
    parentNode.appendChild(button);
  }
  return button;
};

// Gallery UI構造完全流用のTimeTravelUI
export class TimeTravelUI {
  private modal: HTMLDialogElement | null = null;
  private router: TimeTravelRouter;

  constructor(router: TimeTravelRouter) {
    this.router = router;
    this.createModal();
  }

  private createModal(): void {
    this.modal = document.createElement("dialog");
    this.modal.id = "wplace-studio-timetravel-modal";
    this.modal.className = "modal";
    this.modal.innerHTML = t`
      <div class="modal-box w-11/12 max-w-4xl">
        <!-- Header (Gallery流用) -->
        <div id="wps-timetravel-header" class="flex justify-between items-center mb-4">
          <h3 id="wps-timetravel-title" class="font-bold text-lg">${"timetravel_modal_title"}</h3>
          <div class="flex gap-2">
            <button id="wps-timetravel-back-btn" class="btn btn-sm btn-ghost hidden">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
                <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clip-rule="evenodd" />
              </svg>
              ${"back"}
            </button>
            <button class="btn btn-sm btn-ghost" onclick="this.closest('dialog').close()">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
                <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div id="wps-timetravel-content" class="min-h-60">
          <!-- ルート別コンテンツがここに挿入される -->
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;

    document.body.appendChild(this.modal);
    this.setupEvents();
  }

  private setupEvents(): void {
    // Back button
    this.modal?.querySelector("#wps-timetravel-back-btn")?.addEventListener("click", () => {
      this.router.navigateBack();
    });
  }

  updateHeader(route: TimeTravelRoute): void {
    const title = this.modal?.querySelector("#wps-timetravel-title");
    const backBtn = this.modal?.querySelector("#wps-timetravel-back-btn");

    if (!title || !backBtn) return;

    // タイトル更新
    switch (route) {
      case "current-position":
        title.textContent = t`${"timetravel_current_position"}`;
        break;
      case "tile-list":
        title.textContent = t`${"timetravel_tile_list"}`;
        break;
      case "tile-snapshots":
        title.textContent = t`${"timetravel_tile_snapshots"}`;
        break;
    }

    // Back button表示/非表示
    if (this.router.canNavigateBack()) {
      backBtn.classList.remove("hidden");
    } else {
      backBtn.classList.add("hidden");
    }
  }

  getContainer(): HTMLElement | null {
    return this.modal?.querySelector("#wps-timetravel-content") as HTMLElement | null;
  }

  showModal(): void {
    (this.modal as HTMLDialogElement)?.showModal();
  }

  hideModal(): void {
    this.modal?.close();
  }
}

// ダウンロード用Modal（既存維持）
export const createSnapshotDownloadModal = (): HTMLDialogElement => {
  const modal = document.createElement("dialog");
  modal.id = "wplace-studio-snapshot-download-modal";
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box w-11/12 max-w-4xl">
      <h3 class="font-bold text-lg mb-4">${"snapshot_download_title"}</h3>
      
      <div class="flex flex-col items-center justify-center mb-4">
        <div class="flex items-center justify-center" style="max-height: 70vh; max-width: 90vw;">
          <img id="wps-snapshot-image" src="" alt="Snapshot" class="" style="image-rendering: pixelated; min-width: 50vw; max-width: 90vw; max-height: 70vh; object-fit: contain; aspect-ratio: auto;">
        </div>
      </div>
      
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
