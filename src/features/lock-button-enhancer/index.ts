import { setupElementObserver } from "@/components/element-observer";
import {
  loadLockButtonEnhancerFromStorage,
  getLockButtonEnhancer,
} from "@/states/lock-button-enhancer";

/**
 * Lockボタンを押しやすくする機能（モバイルモード専用）
 * - Lockボタンのスタイルを調整してクリックしやすくする
 */
export class LockButtonEnhancer {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Load setting from storage
    await loadLockButtonEnhancerFromStorage();
    const enabled = getLockButtonEnhancer();

    if (!enabled) return;

    setupElementObserver([
      {
        id: "lock-button-enhancer",
        getTargetElement: () => this.findLockButton(),
        createElement: (lockButton) => {
          this.enhanceLockButton(lockButton);
        },
      },
    ]);
  }

  private findLockButton(): Element | null {
    // title="Lock" or title="Unlock" (when locked)
    const lockButton = document.querySelector('[title="Lock"]');
    if (lockButton) return lockButton;

    const unlockButton = document.querySelector('[title="Unlock"]');
    if (unlockButton) return unlockButton;

    // Portuguese: "Loja" (Lock) or "Desbloquear" (Unlock)
    const lojaButton = document.querySelector('[title="Loja"]');
    if (lojaButton) return lojaButton;

    const desbloquearButton = document.querySelector('[title="Desbloquear"]');
    return desbloquearButton;
  }

  private enhanceLockButton(lockButton: Element): void {
    const button = lockButton as HTMLElement;

    // Apply styles
    button.style.borderRadius = "0";
    button.style.width = "48px";
    button.style.height = "48px";

    // Apply styles to parent container
    const container = button.parentNode?.parentNode?.parentNode as HTMLElement;
    if (container) {
      container.style.cssText = "top:0;right:0;";
    }

    // console.log("🧑‍🎨 : Lock button enhanced");
  }
}
