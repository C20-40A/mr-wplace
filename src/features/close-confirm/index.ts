import { findPaintPixelControls } from "@/constants/selectors";
import {
  loadCloseConfirmFromStorage,
  getCloseConfirm,
} from "@/states/close-confirm";
import { t } from "@/i18n/manager";

/**
 * Paint modalを閉じる際に確認ダイアログを表示する機能
 */
export class CloseConfirm {
  private handlerAttached = false;
  private currentButton: HTMLButtonElement | null = null;
  private boundHandler: ((e: MouseEvent) => void) | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await loadCloseConfirmFromStorage();
    const enabled = getCloseConfirm();

    if (!enabled) return;

    this.boundHandler = this.handleClick.bind(this);
    this.observeCloseButton();
  }

  private findCloseButton(): HTMLButtonElement | null {
    const controls = findPaintPixelControls();
    if (!controls?.parentElement) return null;

    // xアイコンのSVGパスを持つボタンを探す
    const buttons = controls.parentElement.querySelectorAll(
      "button.btn.btn-circle.btn-sm"
    );
    for (const button of buttons) {
      const svg = button.querySelector('svg path[d*="m256-200"]');
      if (svg) return button as HTMLButtonElement;
    }

    return null;
  }

  private handleClick(e: MouseEvent): void {
    const isConfirmed = confirm(t`${"confirm_close_paint_modal"}`);

    if (!isConfirmed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      console.log("🧑‍🎨 : Close operation cancelled");
    }
  }

  private observeCloseButton(): void {
    const checkAndAttach = () => {
      const button = this.findCloseButton();

      // ボタンが変わった場合、古いハンドラーを削除
      if (this.currentButton && this.currentButton !== button) {
        if (this.boundHandler) {
          this.currentButton.removeEventListener("click", this.boundHandler, {
            capture: true,
          });
        }
        this.handlerAttached = false;
        this.currentButton = null;
      }

      // 新しいボタンにハンドラーを追加
      if (button && !this.handlerAttached && this.boundHandler) {
        button.addEventListener("click", this.boundHandler, { capture: true });
        this.handlerAttached = true;
        this.currentButton = button;
        console.log("🧑‍🎨 : Close confirm handler attached");
      }

      // ボタンがなくなった場合のリセット
      if (!button && this.handlerAttached) {
        this.handlerAttached = false;
        this.currentButton = null;
      }
    };

    // 初回チェック
    checkAndAttach();

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      requestAnimationFrame(checkAndAttach);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
}
