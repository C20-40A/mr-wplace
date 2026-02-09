import { t } from "@/i18n/manager";
import { Router } from "../utils/router";

export interface ModalOptions {
  id: string;
  title: string;
  hasBackButton?: boolean;
  maxWidth?: string;
  onBack?: () => void;
  containerStyle?: string;
  router?: Router<any>;
}

export interface ModalElements {
  modal: HTMLDialogElement;
  titleElement: HTMLElement;
  backButton: HTMLElement;
  container: HTMLElement;
  destroy: () => void;
}

/**
 * 名称入力Modal
 * - NOTE: 空文字は''。キャンセルの場合はnullを返す
 */
export const showNameInputModal = (
  title: string,
  placeholder: string,
  defaultValue = ""
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

    let resolved = false;

    const handleSave = () => {
      if (resolved) return;
      resolved = true;
      const value = nameInput.value.trim();
      modal.close();
      resolve(value ?? "");
    };

    const handleCancel = () => {
      if (resolved) return;
      resolved = true;
      modal.close();
      resolve(null);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") handleCancel();
    };

    saveBtn.addEventListener("click", handleSave);
    cancelBtn.addEventListener("click", handleCancel);
    backdropBtn.addEventListener("click", handleCancel);
    nameInput.addEventListener("keydown", handleKeydown);

    // close イベントで完全破棄
    modal.addEventListener("close", () => {
      console.log("🧑‍🎨 : Name input modal closed, cleaning up...");

      // イベントリスナー解除
      saveBtn.removeEventListener("click", handleSave);
      cancelBtn.removeEventListener("click", handleCancel);
      backdropBtn.removeEventListener("click", handleCancel);
      nameInput.removeEventListener("keydown", handleKeydown);

      // DOM 削除
      modal.remove();

      // resolveされていない場合はキャンセル扱い
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    });

    nameInput.value = defaultValue;
    modal.showModal();
    nameInput.focus();
  });
};

export const createModal = (options: ModalOptions): ModalElements => {
  const {
    id,
    title,
    hasBackButton: explicitHasBackButton,
    maxWidth = "64rem",
    onBack: explicitOnBack,
    containerStyle,
    router,
  } = options;

  // routerがある場合は自動でbackボタンを有効化
  const hasBackButton = explicitHasBackButton ?? !!router;
  const onBack =
    explicitOnBack ?? (router ? () => router.navigateBack() : undefined);

  const modal = document.createElement("dialog");
  modal.id = id;
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box" style="width: 91.666667%; max-width: ${maxWidth}; max-height: 90dvh; display: flex; flex-direction: column; padding: 1.5rem 1rem; ${containerStyle}">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4" style="flex-shrink: 0;">
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
        <button id="${id}-close-btn" class="btn btn-sm btn-ghost">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <!-- Content Area -->
      <div id="${id}-content" style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
        <!-- ルート別コンテンツがここに挿入される -->
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button id="${id}-backdrop-btn">close</button>
    </form>
  `;

  document.body.appendChild(modal);

  const titleElement = modal.querySelector(`#${id}-title`) as HTMLElement;
  const backButton = modal.querySelector(`#${id}-back-btn`) as HTMLElement;
  const container = modal.querySelector(`#${id}-content`) as HTMLElement;
  const closeButton = modal.querySelector(
    `#${id}-close-btn`
  ) as HTMLButtonElement;
  const backdropButton = modal.querySelector(
    `#${id}-backdrop-btn`
  ) as HTMLButtonElement;

  // イベントハンドラーを関数として保持（removeEventListenerで使用するため）
  const handleBack = onBack || (() => {});
  const handleClose = () => modal.close();

  // 一度だけ登録（once オプション使用不可のため、手動管理）
  if (onBack) {
    backButton?.addEventListener("click", handleBack);
  }

  closeButton.addEventListener("click", handleClose);
  backdropButton.addEventListener("click", handleClose);

  // クリーンアップ処理（共通化）
  const cleanup = () => {
    // イベントリスナー解除
    if (onBack) backButton?.removeEventListener("click", handleBack);
    closeButton.removeEventListener("click", handleClose);
    backdropButton.removeEventListener("click", handleClose);

    // router の参照クリア
    if (router?.clearHeaderElements) router.clearHeaderElements();

    // DOM削除
    modal.remove();
  };

  // close時に自動破壊
  modal.addEventListener("close", cleanup);

  // routerがある場合は自動でheader要素を設定
  if (router) {
    router.setHeaderElements(titleElement, backButton);
  }

  // destroy メソッド（手動破壊用）
  const destroy = () => {
    modal.close(); // closeイベントでcleanupが呼ばれる
  };

  return {
    modal,
    titleElement,
    backButton,
    container,
    destroy,
  };
};
