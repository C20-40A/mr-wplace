import { t } from "../i18n/manager";

export interface ModalOptions {
  id: string;
  title: string;
  hasBackButton?: boolean;
  maxWidth?: string;
  onBack?: () => void;
}

export interface ModalElements {
  modal: HTMLDialogElement;
  titleElement: HTMLElement;
  backButton: HTMLElement;
  container: HTMLElement;
}

export const createModal = (options: ModalOptions): ModalElements => {
  const {
    id,
    title,
    hasBackButton = false,
    maxWidth = "64rem",
    onBack,
  } = options;

  const modal = document.createElement("dialog");
  modal.id = id;
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box" style="width: 91.666667%; max-width: ${maxWidth};">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-2">
          <button id="${id}-back-btn" class="btn btn-sm btn-ghost ${
    hasBackButton ? "" : "hidden"
  }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clip-rule="evenodd" />
            </svg>
            ${"back"}
          </button>
          <h3 id="${id}-title" class="font-bold text-lg">${title}</h3>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="this.closest('dialog').close()">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <!-- Content Area -->
      <div id="${id}-content" style="min-height: 200px; max-height: 80vh; overflow: auto;">
        <!-- ルート別コンテンツがここに挿入される -->
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);

  const titleElement = modal.querySelector(`#${id}-title`) as HTMLElement;
  const backButton = modal.querySelector(`#${id}-back-btn`) as HTMLElement;
  const container = modal.querySelector(`#${id}-content`) as HTMLElement;

  if (onBack) {
    backButton?.addEventListener("click", onBack);
  }

  return {
    modal,
    titleElement,
    backButton,
    container,
  };
};
