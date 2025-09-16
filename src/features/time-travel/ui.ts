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


