import { t } from "../../i18n/manager";
import { TimeTravelRouter } from "./router";
import { createModal, ModalElements } from "../../utils/modal";

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
  private modalElements: ModalElements;
  private router: TimeTravelRouter;

  constructor(router: TimeTravelRouter) {
    this.router = router;
    this.createModal();
  }

  private createModal(): void {
    this.modalElements = createModal({
      id: "wplace-studio-timetravel-modal",
      title: t`${"timetravel_modal_title"}`,
      hasBackButton: false,
      onBack: () => this.router.navigateBack(),
    });

    // Header elements setup
    this.router.setHeaderElements(
      this.modalElements.titleElement,
      this.modalElements.backButton
    );
  }

  getContainer(): HTMLElement | null {
    return this.modalElements.container;
  }

  showModal(): void {
    this.modalElements.modal.showModal();
  }

  hideModal(): void {
    this.modalElements.modal.close();
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
