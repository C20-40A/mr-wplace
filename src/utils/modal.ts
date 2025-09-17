import { t } from "../i18n/manager";

export interface ModalOptions {
  id: string;
  title: string;
  hasBackButton?: boolean;
  maxWidth?: string;
  onBack?: () => void;
  containerStyle?: string;
}

export interface ModalElements {
  modal: HTMLDialogElement;
  titleElement: HTMLElement;
  backButton: HTMLElement;
  container: HTMLElement;
}

/**
 * 名称入力Modal（スナップショット用）
 */
export const showNameInputModal = (
  title: string,
  placeholder: string
): Promise<string | null> => {
  return new Promise((resolve) => {
    const modal = document.createElement("dialog");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">${title}</h3>
        <input id="name-input" type="text" placeholder="${placeholder}" 
               class="input input-bordered w-full mb-4" />
        <div class="modal-action">
          <button id="cancel-btn" class="btn">Cancel</button>
          <button id="save-btn" class="btn btn-primary">Save</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" id="backdrop-btn">close</button>
      </form>
    `;

    document.body.appendChild(modal);

    const nameInput = modal.querySelector("#name-input") as HTMLInputElement;
    const saveBtn = modal.querySelector("#save-btn") as HTMLButtonElement;
    const cancelBtn = modal.querySelector("#cancel-btn") as HTMLButtonElement;
    const backdropBtn = modal.querySelector(
      "#backdrop-btn"
    ) as HTMLButtonElement;

    const cleanup = () => {
      modal.remove();
    };

    const handleSave = () => {
      const value = nameInput.value.trim();
      cleanup();
      resolve(value || null); // 空文字時はnull
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    saveBtn.addEventListener("click", handleSave);
    cancelBtn.addEventListener("click", handleCancel);
    backdropBtn.addEventListener("click", handleCancel);

    // Enter押下で保存
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") handleCancel();
    });

    modal.showModal();
    nameInput.focus();
  });
};

export const createModal = (options: ModalOptions): ModalElements => {
  const {
    id,
    title,
    hasBackButton = false,
    maxWidth = "64rem",
    onBack,
    containerStyle,
  } = options;

  const modal = document.createElement("dialog");
  modal.id = id;
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box" style="width: 91.666667%; max-width: ${maxWidth}; ${containerStyle}">
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
