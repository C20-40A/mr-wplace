import { setupElementObserver } from "@/components/element-observer";
import { TOOLBAR_ROW1_ID } from "@/features/position-info";
import { t } from "@/i18n/manager";
import {
  sendDraftModeToInject,
  sendDraftClearToInject,
} from "@/core/bridge";

/**
 * 下書きモード (draft draw)
 *
 * ON の間はペイント予約が backend へ送信されず、overlay 上に下書きとして残る。
 * charge を消費しないので、好きなだけ描いて現地で構図を調整できる。
 *
 * 描画・蓄積は inject 側 (`src/inject/features/draft-draw`) が担当し、
 * content 側は ON/OFF と表示更新のみを持つ。
 */

const BUTTON_ID = "mr-wplace-draft-btn";

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>';

export class DraftDraw {
  private button: HTMLButtonElement | null = null;
  private enabled = false;
  private pixelCount = 0;

  constructor() {
    this.init();
  }

  private init(): void {
    window.addEventListener("message", this.handleInjectMessage);

    setupElementObserver([
      {
        id: BUTTON_ID,
        getTargetElement: () => document.getElementById(TOOLBAR_ROW1_ID),
        createElement: (row) => {
          if (row.querySelector(`#${BUTTON_ID}`)) return;
          this.mountButton(row);
        },
      },
    ]);
  }

  /** inject 側の下書き状態を UI に反映 */
  private handleInjectMessage = (event: MessageEvent): void => {
    if (event.source !== window) return;
    if (event.data?.source !== "mr-wplace-draft-state") return;

    this.enabled = !!event.data.enabled;
    this.pixelCount = event.data.pixelCount ?? 0;
    this.updateButton();
  };

  private mountButton(row: Element): void {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = "btn btn-xs btn-ghost";
    button.style.cssText =
      "height: 1.25rem; min-height: 1.25rem; padding: 0 0.25rem; gap: 0.15rem;";
    button.innerHTML = ICON_SVG;

    button.addEventListener("click", () => this.toggle());
    // 長押し / 右クリックで下書き消去
    button.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.clear();
    });

    row.appendChild(button);
    this.button = button;
    this.updateButton();
  }

  private updateButton(): void {
    const button = this.button;
    if (!button) return;

    const label = this.pixelCount > 0 ? ` ${this.pixelCount}` : "";
    button.innerHTML = `${ICON_SVG}${
      label ? `<span style="font-size:0.65rem;">${label}</span>` : ""
    }`;

    button.title = this.enabled
      ? `${t`${"draft_mode"}`} ON / ${t`${"draft_clear"}`}`
      : t`${"draft_mode"}`;

    // ON は accent、OFF は既定色
    button.style.color = this.enabled ? "var(--color-accent)" : "";
    button.style.opacity = this.enabled ? "1" : "0.6";
  }

  private toggle(): void {
    this.enabled = !this.enabled;
    sendDraftModeToInject(this.enabled);
    this.updateButton();
  }

  private clear(): void {
    if (this.pixelCount === 0) return;
    sendDraftClearToInject();
  }
}
