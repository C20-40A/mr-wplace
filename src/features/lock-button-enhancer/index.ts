import { setupElementObserver } from "@/components/element-observer";
import { findLockButton } from "@/constants/selectors";
import {
  loadLockButtonEnhancerFromStorage,
  getLockButtonEnhancer,
} from "@/states/lock-button-enhancer";

/**
 * Lockボタンを押しやすくする機能（モバイルモード専用）
 * - ボタンを `btn-xl` で大きくする
 * - 画面右上端に密着させて押しやすくする
 *
 * NOTE: ボタンの探し方は `findLockButton()` (src/constants/selectors.ts) に集約。
 * wplace の新UIで `title` が `aria-label` / `data-tooltip` に変わったため、
 * 属性ベースの検索に切り替えている (旧UIの title も互換で残している)。
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
        getTargetElement: findLockButton,
        createElement: (lockButton) => {
          this.enhanceLockButton(lockButton);
        },
      },
    ]);
  }

  private enhanceLockButton(lockButton: Element): void {
    const button = lockButton as HTMLElement;

    // サイズは daisyUI の `btn-xl` に任せる。
    // NOTE: 以前は inline の width/height 48px を直接書いていたが、
    // サイズ変更のたびに値を追う羽目になるので class に寄せる。
    button.classList.add("btn-xl");

    // 画面端に密着させるので角丸を殺す (丸型だと端の隙間が目立つため)
    button.style.borderRadius = "0";

    // 親コンテナの safe-area 用 margin (`top-safe-2` / `right-safe-2`) を
    // inline で打ち消して右上端に寄せる。
    // NOTE: 以前は `cssText` を丸ごと上書きしていたが、コンテナに他の
    // inline style が付いた瞬間に巻き込んで壊すので top/right だけ触る。
    const container = button.parentElement?.parentElement
      ?.parentElement as HTMLElement | null | undefined;
    if (container) {
      container.style.top = "0";
      container.style.right = "0";
    }

    // console.log("🧑‍🎨 : Lock button enhanced");
  }
}
