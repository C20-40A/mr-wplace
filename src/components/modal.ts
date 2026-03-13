import { t } from "@/i18n/manager";
import { Router } from "../utils/router";
import { isMobileViewport } from "@/constants/breakpoints";

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
  minimizeButton: HTMLElement;
  destroy: () => void;
}

type DialogLikeElement = HTMLDialogElement & {
  __dialogLike: {
    isOpen: boolean;
    returnValue: string;
  };
};

const dialogLikeStack: DialogLikeElement[] = [];

export const hasOpenModal = (): boolean => dialogLikeStack.length > 0;

const createDialogLikeModal = (): HTMLDialogElement => {
  const modal = document.createElement("div") as DialogLikeElement;
  modal.className = "modal";
  modal.__dialogLike = { isOpen: false, returnValue: "" };
  const nativeRemove = modal.remove.bind(modal);
  let escListening = false;

  const addEscListener = () => {
    if (escListening) return;
    document.addEventListener("keydown", handleEsc, true);
    escListening = true;
  };

  const removeEscListener = () => {
    if (!escListening) return;
    document.removeEventListener("keydown", handleEsc, true);
    escListening = false;
  };

  const removeFromStack = () => {
    const index = dialogLikeStack.indexOf(modal);
    if (index >= 0) dialogLikeStack.splice(index, 1);
  };

  const moveToStackTop = () => {
    removeFromStack();
    dialogLikeStack.push(modal);
  };

  const setOpenState = (open: boolean) => {
    modal.__dialogLike.isOpen = open;
    modal.classList.toggle("modal-open", open);
    if (open) {
      moveToStackTop();
      modal.setAttribute("open", "");
      addEscListener();
      return;
    }

    removeFromStack();
    modal.removeAttribute("open");
    removeEscListener();
  };

  const closeModal = () => {
    if (!modal.__dialogLike.isOpen) return;
    setOpenState(false);
    modal.dispatchEvent(new Event("close"));
  };

  const handleEsc = (e: KeyboardEvent) => {
    if (!modal.__dialogLike.isOpen || e.key !== "Escape") return;
    if (dialogLikeStack[dialogLikeStack.length - 1] !== modal) return;
    const cancelEvent = new Event("cancel", { cancelable: true });
    if (!modal.dispatchEvent(cancelEvent)) return;
    closeModal();
  };

  Object.defineProperties(modal, {
    open: {
      get: () => modal.__dialogLike.isOpen,
      set: (value: boolean) => setOpenState(Boolean(value)),
      configurable: true,
    },
    returnValue: {
      get: () => modal.__dialogLike.returnValue,
      set: (value: string) => {
        modal.__dialogLike.returnValue = value;
      },
      configurable: true,
    },
    show: {
      value: () => {
        if (modal.__dialogLike.isOpen) return;
        setOpenState(true);
      },
      configurable: true,
    },
    showModal: {
      value: () => {
        if (modal.__dialogLike.isOpen) return;
        setOpenState(true);
      },
      configurable: true,
    },
    close: {
      value: (returnValue?: string) => {
        if (typeof returnValue === "string")
          modal.__dialogLike.returnValue = returnValue;
        closeModal();
      },
      configurable: true,
    },
    remove: {
      value: () => {
        setOpenState(false);
        nativeRemove();
      },
      configurable: true,
    },
  });

  return modal;
};

/**
 * 名称入力Modal
 * - NOTE: 空文字は''。キャンセルの場合はnullを返す
 */
export const showNameInputModal = (
  title: string,
  placeholder: string,
  defaultValue = "",
): Promise<string | null> => {
  return new Promise((resolve) => {
    const modal = createDialogLikeModal();
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
      <div class="modal-backdrop">
        <button type="button" id="backdrop-btn" aria-label="${t`close`}"></button>
      </div>
    `;

    document.body.appendChild(modal);

    const nameInput = modal.querySelector("#name-input") as HTMLInputElement;
    const saveBtn = modal.querySelector("#save-btn") as HTMLButtonElement;
    const cancelBtn = modal.querySelector("#cancel-btn") as HTMLButtonElement;
    const backdropBtn = modal.querySelector(
      "#backdrop-btn",
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

  const modal = createDialogLikeModal();
  modal.id = id;
  modal.innerHTML = t`
    <div class="modal-box" style="width: 91.666667%; max-width: ${maxWidth}; ${isMobileViewport() ? "max-height: 95vh;" : "max-height: 90vh;"} display: flex; flex-direction: column; padding:${isMobileViewport() ? "1rem .5rem" : " 1.5rem 1rem"}; ${containerStyle}">
      <!-- Header -->
      <div class="flex justify-between items-center ${isMobileViewport() ? "mb-2" : "mb-4"}" style="flex-shrink: 0;">
        <div class="flex items-center gap-2">
          <button id="${id}-back-btn" class="btn btn-sm btn-ghost ${
            hasBackButton ? "" : "hidden"
          }">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clip-rule="evenodd" />
            </svg>
            ${"back"}
          </button>
          <h3 id="${id}-title" class="font-bold ${isMobileViewport() ? "text" : "text-lg"}">${title}</h3>
        </div>
        <div class="flex items-center gap-1">
          <button id="${id}-minimize-btn" class="btn btn-sm btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M3 9a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 9zm0 6.75a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
            </svg>
          </button>
          <button id="${id}-close-btn" class="btn btn-sm btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content Area -->
      <div id="${id}-content" style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
        <!-- ルート別コンテンツがここに挿入される -->
      </div>
    </div>
    <div class="modal-backdrop">
      <button id="${id}-backdrop-btn" aria-label="${t`close`}"></button>
    </div>
  `;

  document.body.appendChild(modal);

  const titleElement = modal.querySelector(`#${id}-title`) as HTMLElement;
  const backButton = modal.querySelector(`#${id}-back-btn`) as HTMLElement;
  const container = modal.querySelector(`#${id}-content`) as HTMLElement;
  const minimizeButton = modal.querySelector(
    `#${id}-minimize-btn`,
  ) as HTMLButtonElement;
  const closeButton = modal.querySelector(
    `#${id}-close-btn`,
  ) as HTMLButtonElement;
  const backdropButton = modal.querySelector(
    `#${id}-backdrop-btn`,
  ) as HTMLButtonElement;
  const modalBox = modal.querySelector(".modal-box") as HTMLElement;
  const backdrop = modal.querySelector(".modal-backdrop") as HTMLElement;
  const initialStyles = {
    containerDisplay: container.style.display,
    modalPointerEvents: modal.style.pointerEvents,
    modalBoxPointerEvents: modalBox.style.pointerEvents,
    modalBoxPosition: modalBox.style.position,
    modalBoxTop: modalBox.style.top,
    modalBoxLeft: modalBox.style.left,
    modalBoxTransform: modalBox.style.transform,
    modalBoxWidth: modalBox.style.width,
    modalBoxMaxWidth: modalBox.style.maxWidth,
    modalBoxMargin: modalBox.style.margin,
    backdropDisplay: backdrop.style.display,
    backdropPointerEvents: backdrop.style.pointerEvents,
    backdropBackgroundColor: backdrop.style.backgroundColor,
  };

  // イベントハンドラーを関数として保持（removeEventListenerで使用するため）
  const handleBack = onBack || (() => {});
  const handleClose = () => modal.close();

  let isMinimized = false;
  const handleMinimize = () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      // 最小化: ヘッダーだけ残し、背面はクリック透過
      container.style.display = "none";
      modal.style.pointerEvents = "none";
      modalBox.style.pointerEvents = "auto";
      modalBox.style.position = "fixed";
      modalBox.style.top = "1rem";
      modalBox.style.left = "50%";
      modalBox.style.transform = "translateX(-50%)";
      modalBox.style.width = "fit-content";
      modalBox.style.maxWidth = "fit-content";
      modalBox.style.margin = "0";
      backdrop.style.display = "none";
      backdrop.style.pointerEvents = "none";
      backdrop.style.backgroundColor = "transparent";
    } else {
      // 元に戻す: 最小化前スタイルを復元
      container.style.display = initialStyles.containerDisplay;
      modal.style.pointerEvents = initialStyles.modalPointerEvents;
      modalBox.style.pointerEvents = initialStyles.modalBoxPointerEvents;
      modalBox.style.position = initialStyles.modalBoxPosition;
      modalBox.style.top = initialStyles.modalBoxTop;
      modalBox.style.left = initialStyles.modalBoxLeft;
      modalBox.style.transform = initialStyles.modalBoxTransform;
      modalBox.style.width = initialStyles.modalBoxWidth;
      modalBox.style.maxWidth = initialStyles.modalBoxMaxWidth;
      modalBox.style.margin = initialStyles.modalBoxMargin;
      backdrop.style.display = initialStyles.backdropDisplay;
      backdrop.style.pointerEvents = initialStyles.backdropPointerEvents;
      backdrop.style.backgroundColor = initialStyles.backdropBackgroundColor;
    }
  };

  // 一度だけ登録（once オプション使用不可のため、手動管理）
  if (onBack) {
    backButton?.addEventListener("click", handleBack);
  }

  minimizeButton.addEventListener("click", handleMinimize);
  closeButton.addEventListener("click", handleClose);
  backdropButton.addEventListener("click", handleClose);

  // クリーンアップ処理（共通化）
  const cleanup = () => {
    // イベントリスナー解除
    if (onBack) backButton?.removeEventListener("click", handleBack);
    minimizeButton.removeEventListener("click", handleMinimize);
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
    minimizeButton,
    destroy,
  };
};
