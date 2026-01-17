import { t } from "@/i18n/manager";
import { runtime } from "@/utils/browser-api";

interface TutorialItem {
  id: string;
  titleKey: string;
  gifUrl?: string;
  steps: string[];
}

/**
 * チュートリアル機能
 * ギャラリーなどの画面にチュートリアルボタンを表示し、モーダルでチュートリアルを表示
 */
export class Tutorial {
  private button: HTMLButtonElement | null = null;
  private modal: HTMLDialogElement | null = null;
  private handleMouseEnter = () => {
    if (this.button) this.button.style.opacity = "1";
  };
  private handleMouseLeave = () => {
    if (this.button) this.button.style.opacity = "0.4";
  };
  private handleButtonClick = () => this.showModal();

  private tutorials: TutorialItem[] = [
    {
      id: "how_to_draw",
      titleKey: "tutorial_how_to_draw_title",
      gifUrl: runtime.getURL("assets/images/tutorial/how_to_draw.gif"),
      steps: [
        "tutorial_how_to_draw_step1",
        "tutorial_how_to_draw_step2",
        "tutorial_how_to_draw_step3",
      ],
    },
    {
      id: "how_to_archive",
      titleKey: "tutorial_how_to_archive_title",
      gifUrl: runtime.getURL("assets/images/tutorial/how_to_archive.gif"),
      steps: [
        "tutorial_how_to_archive_step1",
        "tutorial_how_to_archive_step2",
      ],
    },
    {
      id: "how_to_draw_archive",
      titleKey: "tutorial_how_to_draw_archive_title",
      gifUrl: runtime.getURL("assets/images/tutorial/how_to_draw_archive.gif"),
      steps: [
        "tutorial_how_to_draw_archive_step1",
        "tutorial_how_to_draw_archive_step2",
        "tutorial_how_to_draw_archive_step3",
      ],
    },
  ];

  /**
   * チュートリアルボタンを作成して、指定されたコンテナに追加
   */
  createButton(container: HTMLElement): HTMLButtonElement {
    // 既にボタンが存在する場合は再利用
    if (this.button) {
      if (this.button.parentElement !== container) {
        container.appendChild(this.button);
      }
      return this.button;
    }

    this.button = document.createElement("button");
    this.button.className = "btn btn-circle btn-sm btn-ghost";
    this.button.style.cssText =
      "position: fixed; bottom: 1rem; left: 1rem; z-index: 10; opacity: 0.4; transition: opacity 0.2s;";
    this.button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd"/>
      </svg>
    `;

    this.button.addEventListener("mouseenter", this.handleMouseEnter);
    this.button.addEventListener("mouseleave", this.handleMouseLeave);
    this.button.addEventListener("click", this.handleButtonClick);

    container.appendChild(this.button);
    return this.button;
  }

  /**
   * チュートリアル一覧モーダルを表示
   */
  private showModal(): void {
    if (this.modal) {
      this.modal.remove();
    }

    this.modal = document.createElement("dialog");
    this.modal.className = "modal";
    this.modal.style.cssText = "z-index: 10000;";

    const modalBox = document.createElement("div");
    modalBox.className = "modal-box max-w-2xl";
    modalBox.style.cssText = "max-height: 80vh; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-4";

    const title = document.createElement("h3");
    title.className = "font-bold text-lg";
    title.textContent = t`${"tutorial_title"}`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-sm btn-circle btn-ghost";
    closeBtn.innerHTML = "✕";
    closeBtn.onclick = () => this.closeModal();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // チュートリアル一覧
    const tutorialList = document.createElement("div");
    tutorialList.className = "space-y-3";

    this.tutorials.forEach((tutorial) => {
      const item = this.createTutorialListItem(tutorial);
      tutorialList.appendChild(item);
    });

    modalBox.appendChild(header);
    modalBox.appendChild(tutorialList);
    this.modal.appendChild(modalBox);

    // 背景クリック用のフォーム
    const backdropForm = document.createElement("form");
    backdropForm.method = "dialog";
    backdropForm.className = "modal-backdrop";
    const backdropBtn = document.createElement("button");
    backdropBtn.textContent = "close";
    backdropForm.appendChild(backdropBtn);
    this.modal.appendChild(backdropForm);

    document.body.appendChild(this.modal);
    this.modal.showModal();
  }

  /**
   * チュートリアル一覧のアイテムを作成
   */
  private createTutorialListItem(tutorial: TutorialItem): HTMLElement {
    const item = document.createElement("div");
    item.className =
      "card bg-base-200 hover:bg-base-300 cursor-pointer transition-colors";
    item.onclick = () => this.showTutorialDetail(tutorial);

    const cardBody = document.createElement("div");
    cardBody.className = "card-body p-4";

    const titleEl = document.createElement("h4");
    titleEl.className = "card-title text-base";
    titleEl.textContent = t`${tutorial.titleKey}`;

    cardBody.appendChild(titleEl);
    item.appendChild(cardBody);

    return item;
  }

  /**
   * チュートリアル詳細を表示
   */
  private showTutorialDetail(tutorial: TutorialItem): void {
    if (!this.modal) return;

    const modalBox = this.modal.querySelector(".modal-box");
    if (!modalBox) return;

    modalBox.innerHTML = "";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "flex justify-between items-center mb-4";

    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-sm btn-ghost";
    backBtn.innerHTML = "← " + t`${"back"}`;
    backBtn.onclick = () => this.showModal();

    const title = document.createElement("h3");
    title.className = "font-bold text-lg flex-1 text-center";
    title.textContent = t`${tutorial.titleKey}`;

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn btn-sm btn-circle btn-ghost";
    closeBtn.innerHTML = "✕";
    closeBtn.onclick = () => this.closeModal();

    header.appendChild(backBtn);
    header.appendChild(title);
    header.appendChild(closeBtn);

    modalBox.appendChild(header);

    // GIF表示
    if (tutorial.gifUrl) {
      const gifContainer = document.createElement("div");
      gifContainer.className = "flex justify-center mb-6";

      const gif = document.createElement("img");
      gif.src = tutorial.gifUrl;
      gif.alt = t`${tutorial.titleKey}`;
      gif.style.cssText =
        "width: 100%; max-width: 24rem; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);";

      gifContainer.appendChild(gif);
      modalBox.appendChild(gifContainer);
    }

    // ステップ一覧
    const stepsList = document.createElement("ol");
    stepsList.className = "space-y-3";
    stepsList.style.cssText = "list-style: decimal; padding-left: 1.5rem;";

    tutorial.steps.forEach((stepKey) => {
      const stepItem = document.createElement("li");
      stepItem.className = "text-base";
      stepItem.textContent = t`${stepKey}`;
      stepsList.appendChild(stepItem);
    });

    modalBox.appendChild(stepsList);
  }

  /**
   * モーダルを閉じる
   */
  private closeModal(): void {
    if (this.modal) {
      this.modal.close();
      this.modal.remove();
      this.modal = null;
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.button) {
      this.button.removeEventListener("mouseenter", this.handleMouseEnter);
      this.button.removeEventListener("mouseleave", this.handleMouseLeave);
      this.button.removeEventListener("click", this.handleButtonClick);
      this.button.remove();
      this.button = null;
    }
    this.closeModal();
  }
}
