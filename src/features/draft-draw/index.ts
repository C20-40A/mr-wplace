import { setupElementObserver } from "@/components/element-observer";
import {
  findPaintPixelControls,
  findPaintSubmitContainer,
} from "@/constants/selectors";
import { Toast } from "@/components/toast";
import { t } from "@/i18n/manager";
import {
  sendDraftModeToInject,
  sendDraftClearToInject,
  requestDraftExport,
  sendGalleryImagesToInject,
} from "@/core/bridge";
import { GalleryStorage } from "@/states/galleryStorage";

/**
 * 下書きモード (draft draw / blueprint)
 *
 * ON の間はペイント送信が inject 側で遮断され、charge を消費せずに
 * overlay 上へ下書きが残る。
 *
 * SAFETY:
 * - ボタンはペイントモーダル内にのみ出す (モード外で ON にできない)
 * - ON 中は wplace の Paint ボタンを隠し、代わりに「下書きを保存」を出す
 *   -> 誤って本送信する導線自体を消す
 * - ON->OFF / モーダルを閉じた時は下書きを破棄 (残留させない)
 * - 実送信の最終遮断は inject 側 `shouldBlockPaintSubmit()` が担当
 */

const BUTTON_ID = "mr-wplace-draft-btn";
const SAVE_BUTTON_ID = "mr-wplace-draft-save-btn";
const FAB_ID = "mr-wplace-draft-fab";

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:18px;height:18px;"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>';

export class DraftDraw {
  private enabled = false;
  private pixelCount = 0;
  private saving = false;
  private closeObserver: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    window.addEventListener("message", this.handleInjectMessage);

    setupElementObserver([
      {
        // mini-color-filter-fab の下に固定配置 (モバイルのstatus bar圧迫を回避)
        id: FAB_ID,
        getTargetElement: () =>
          findPaintPixelControls() ? document.body : null,
        createElement: () => {
          if (document.getElementById(FAB_ID)) return;
          this.mountFab();
        },
      },
    ]);
  }

  private handleInjectMessage = (event: MessageEvent): void => {
    if (event.source !== window) return;
    const source = event.data?.source;

    if (source === "mr-wplace-draft-state") {
      this.enabled = !!event.data.enabled;
      this.pixelCount = event.data.pixelCount ?? 0;
      this.render();
      return;
    }

    if (source === "mr-wplace-draft-submit-blocked")
      Toast.show(t`${"draft_blocked_notice"}`, "error");
  };

  private mountFab(): void {
    const button = document.createElement("button");
    button.id = FAB_ID;
    button.type = "button";
    button.className = "btn btn-sm btn-square shadow-md";
    // mini-color-filter-fab: top:8px/left:8px, 高さ約32px。その直下へ
    button.style.cssText =
      "position:fixed; top:48px; left:8px; z-index:40;";
    button.addEventListener("click", () => this.toggle());

    document.body.appendChild(button);
    this.observePaintControlsClose();
    this.render();
  }

  /**
   * ペイントモーダルが閉じたら FAB を撤去する。
   * element-observer は生成のみ担当し削除しないため、ここで面倒を見る。
   * 残すとモード外で ON にできてしまい危険。
   */
  private observePaintControlsClose(): void {
    this.closeObserver?.disconnect();

    const observer = new MutationObserver(() => {
      if (findPaintPixelControls()) return;

      // Paint ボタンを隠したままにしない (念のための復帰)
      this.enabled = false;
      this.renderSubmitArea();

      document.getElementById(FAB_ID)?.remove();
      document.getElementById(SAVE_BUTTON_ID)?.remove();
      observer.disconnect();
      this.closeObserver = null;
      // inject 側もセッション終了で mode OFF + 下書き破棄される
      this.enabled = false;
      this.pixelCount = 0;
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this.closeObserver = observer;
  }

  /** ボタン表示 + Paint ボタン差し替えをまとめて反映 */
  private render(): void {
    this.renderFab();
    this.renderSubmitArea();
  }

  private renderFab(): void {
    const button = document.getElementById(FAB_ID) as HTMLButtonElement | null;
    if (!button) return;

    button.innerHTML = ICON_SVG;
    button.title = this.enabled
      ? t`${"draft_blocked_notice"}`
      : t`${"draft_mode"}`;

    // ON は警告色で強く主張する (誤操作防止)
    if (this.enabled) {
      button.style.background = "var(--color-warning)";
      button.style.color = "var(--color-warning-content)";
      button.style.opacity = "1";
    } else {
      button.style.background = "";
      button.style.color = "";
      button.style.opacity = "0.75";
    }
  }

  /**
   * 下書きモード中は wplace の Paint ボタンを隠し、保存ボタンに差し替える。
   * 誤送信の導線そのものを消すのが目的。
   */
  private renderSubmitArea(): void {
    const container = findPaintSubmitContainer();
    if (!container) return;

    const paintButton = container.querySelector(
      "button.btn-primary"
    ) as HTMLElement | null;
    let saveButton = document.getElementById(
      SAVE_BUTTON_ID
    ) as HTMLButtonElement | null;

    if (!this.enabled) {
      if (paintButton) paintButton.style.display = "";
      saveButton?.remove();
      return;
    }

    if (paintButton) paintButton.style.display = "none";

    if (!saveButton) {
      saveButton = document.createElement("button");
      saveButton.id = SAVE_BUTTON_ID;
      saveButton.type = "button";
      saveButton.className = "btn btn-lg sm:btn-xl";
      saveButton.style.cssText =
        "max-width:none; background:var(--color-warning); color:var(--color-warning-content);";
      saveButton.addEventListener("click", () => void this.save());
      container.appendChild(saveButton);
    }

    saveButton.disabled = this.saving || this.pixelCount === 0;
    saveButton.style.opacity = saveButton.disabled ? "0.6" : "1";
    saveButton.innerHTML = `<div class="flex items-center gap-1.5">${ICON_SVG}<span>${t`${"draft_save"}`}${
      this.pixelCount > 0 ? ` (${this.pixelCount})` : ""
    }</span></div>`;
  }

  /** 下書きを gallery へ保存 */
  private async save(): Promise<void> {
    if (this.saving || this.pixelCount === 0) return;
    this.saving = true;
    this.renderSubmitArea();

    try {
      const result = await requestDraftExport();
      if (!result) {
        Toast.show(t`${"draft_save_failed"}`, "error");
        return;
      }

      await new GalleryStorage().save({
        key: `draft-${Date.now()}`,
        timestamp: Date.now(),
        dataUrl: result.dataUrl,
        title: `${t`${"draft_mode"}`} ${new Date().toLocaleString()}`,
        drawPosition: result.coords,
        drawEnabled: true,
        width: result.width,
        height: result.height,
      });
      await sendGalleryImagesToInject();

      Toast.show(t`${"saved_to_gallery"}`, "success");
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save draft:", error);
      Toast.show(t`${"draft_save_failed"}`, "error");
    } finally {
      this.saving = false;
      this.renderSubmitArea();
    }
  }

  private toggle(): void {
    // SAFETY: OFF -> ON は確認必須
    if (!this.enabled) {
      if (!window.confirm(t`${"draft_confirm_body"}`)) return;
      this.enabled = true;
      sendDraftModeToInject(true);
      this.render();
      return;
    }

    // ON -> OFF: 未保存の下書きがあれば破棄の確認を出す
    if (
      this.pixelCount > 0 &&
      !window.confirm(t`${"draft_discard_confirm"}`)
    )
      return;

    this.enabled = false;
    sendDraftClearToInject();
    sendDraftModeToInject(false);
    this.render();
  }
}
