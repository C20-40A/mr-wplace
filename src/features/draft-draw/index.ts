import { setupElementObserver } from "@/components/element-observer";
import {
  findMyLocationContainer,
  findPaintPixelControls,
  findPaintEntryButton,
  findPaintSubmitButton,
} from "@/constants/selectors";
import { Toast } from "@/components/toast";
import { t } from "@/i18n/manager";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import {
  sendDraftModeToInject,
  requestDraftExport,
  requestDraftSeed,
  sendGalleryImagesToInject,
} from "@/core/bridge";
import { GalleryItem, GalleryStorage } from "@/states/galleryStorage";
import { getImageDataUrl } from "@/utils/indexed-db-bridge";
import { tilePixelToLatLng } from "@/utils/coordinate";

/**
 * 下書きモード (draft draw / blueprint)
 *
 * 導線:
 *   マップ上の下書きFAB → クリック → wplace の Paint ボタンを自動クリック
 *   → ペイントモードへ遷移 → 同時に下書きモードON
 *
 * ペイントモードとの切替動線を持たないので、
 * 「気づかないうちに下書きモード」も「誤って本送信」も構造的に起きない。
 *
 * 下書きモード中は wplace 純正 UI のみを使う。
 * (Mr 追加のFABは paint-mode-style が既に隠すため、ここでは何も足さない)
 *
 * SAFETY:
 * - 送信の最終遮断は inject 側 `shouldBlockPaintSubmit()` が担当
 * - ペイントモーダルを閉じたらモードも下書きも破棄される
 */

const FAB_ID = "mr-wplace-draft-fab";
const SAVE_BUTTON_ID = "mr-wplace-draft-save-btn";
/** 下書き保存で作られたギャラリー item。再保存で上書きする */
const SAVED_KEY_PREFIX = "draft-";

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:calc(var(--spacing)*8);height:calc(var(--spacing)*8);"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>';

export class DraftDraw {
  private enabled = false;
  private pixelCount = 0;
  private saving = false;
  /** 保存済みギャラリーitemのkey。2回目以降は更新扱いにする */
  private savedKey: string | null = null;
  /** 下書き編集で開始した場合の元item。保存時にtitle等を引き継ぐ */
  private seedItem: GalleryItem | null = null;
  private closeObserver: MutationObserver | null = null;
  /** display:none にした確定ボタン。隠すと再検索できないため参照を保持する */
  private hiddenSubmitButton: HTMLElement | null = null;
  private submitContainer: HTMLElement | null = null;

  constructor() {
    this.init();
    activeInstance = this;
  }

  private init(): void {
    window.addEventListener("message", this.handleInjectMessage);

    setupElementObserver([
      {
        id: FAB_ID,
        // ペイントモード外でのみ出す (bookmark等と同じ右下スタック)
        getTargetElement: () =>
          findPaintPixelControls() ? null : findMyLocationContainer(),
        createElement: (container) => {
          if (container.querySelector(`#${FAB_ID}`)) return;
          this.mountFab(container);
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
      this.renderSaveButton();
      return;
    }

    if (source === "mr-wplace-draft-submit-blocked")
      Toast.show(t`${"draft_blocked_notice"}`, "error");
  };

  private mountFab(container: Element): void {
    const button = document.createElement("button");
    button.id = FAB_ID;
    button.type = "button";
    button.className =
      "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
    button.innerHTML = ICON_SVG;
    button.title = t`${"draft_mode"}`;
    button.addEventListener("click", () => this.enterDraftMode());

    container.className += " flex flex-col-reverse gap-1";
    button.style.order = "1";
    container.appendChild(button);

    this.syncFabAvailability();
  }

  /**
   * map instance が無いと座標変換ができず保存もできないため無効化する。
   * 準備完了は非同期なので、押せるようになるまで定期的に見直す。
   */
  private syncFabAvailability(): void {
    const button = document.getElementById(FAB_ID) as HTMLButtonElement | null;
    if (!button) return;

    const ready = getMapInstanceReady();
    button.disabled = !ready;
    button.style.opacity = ready ? "" : "0.4";
    button.style.cursor = ready ? "" : "not-allowed";
    button.title = ready
      ? t`${"draft_mode"}`
      : `${t`${"draft_mode"}`} (${t`${"map_not_ready"}`})`;

    if (ready) return;
    window.setTimeout(() => this.syncFabAvailability(), 1000);
  }

  /**
   * wplace の Paint ボタンを押してペイントモードへ入り、同時に下書きモードON。
   * ボタンが見つからない場合は何もしない (状態を進めない)。
   *
   * @param seedItem 指定時は下書き編集: 既存画像のピクセルを読み込み、
   *   保存時は新規作成ではなく同じ item を上書きする。
   */
  private enterDraftMode(seedItem?: GalleryItem): void {
    if (!getMapInstanceReady()) return;

    const entryButton = findPaintEntryButton();
    // disabled (チャージ待ち等) はクリックしても遷移しないので弾く
    if (!entryButton || (entryButton as HTMLButtonElement).disabled) {
      Toast.show(t`${"draft_enter_failed"}`, "error");
      return;
    }

    this.savedKey = seedItem?.key ?? null;
    this.seedItem = seedItem ?? null;
    entryButton.click();

    // Svelte の再描画タイミングが読めないため、ペイントUIの出現を待つ。
    // 出現を確認してから下書きモードを立ち上げる (空振り防止)。
    this.waitForPaintControls()
      .then(async (ready) => {
        if (!ready) {
          Toast.show(t`${"draft_enter_failed"}`, "error");
          return;
        }

        sendDraftModeToInject(true);
        this.enabled = true;
        this.observePaintControlsClose();
        this.renderSaveButton();

        if (seedItem) await this.seedFromItem(seedItem);
      })
      .catch(() => Toast.show(t`${"draft_enter_failed"}`, "error"));
  }

  /** 既存 gallery item のピクセルを下書きへ読み込む (下書き編集) */
  private async seedFromItem(item: GalleryItem): Promise<void> {
    if (!item.drawPosition) return;

    const dataUrl = await getImageDataUrl(item, {
      showToastOnError: true,
      logContext: "draft edit seed",
    });
    if (!dataUrl) return;

    await requestDraftSeed(dataUrl, item.drawPosition);
  }

  /**
   * 既存 gallery item を「下書き編集」として開く。
   * 座標が無い(未配置)画像は編集できない。
   *
   * NOTE: 通常の gotoMapPosition は navigation mode が URL の場合ページを
   * リロードしてしまい、直後のペイントモード遷移が行えなくなる。
   * 下書き編集は map instance が生きていることが前提の機能なので、
   * ここでは常に flyTo (inject 側の smart navigation) を使う。
   */
  async enterDraftEditForItem(item: GalleryItem): Promise<void> {
    if (!getMapInstanceReady()) {
      Toast.show(t`${"map_not_ready"}`, "error");
      return;
    }
    if (!item.drawPosition) {
      Toast.show(t`${"draft_edit_needs_position"}`, "error");
      return;
    }

    const { TLX, TLY, PxX, PxY } = item.drawPosition;
    const { lat, lng } = tilePixelToLatLng(TLX, TLY, PxX, PxY);
    window.postMessage(
      { source: "mr-wplace-map-flyto", lat, lng, zoom: 14 },
      "*"
    );

    this.enterDraftMode(item);
  }

  /** ペイントUIが現れるまで待つ (最大2秒) */
  private waitForPaintControls(timeoutMs = 2000): Promise<boolean> {
    if (findPaintPixelControls()) return Promise.resolve(true);

    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;

      const tick = () => {
        if (findPaintPixelControls()) return resolve(true);
        if (Date.now() > deadline) return resolve(false);
        window.requestAnimationFrame(tick);
      };

      window.requestAnimationFrame(tick);
    });
  }

  /**
   * ペイントモーダルが閉じたら後始末する。
   * element-observer は生成のみ担当し削除しないため、ここで面倒を見る。
   */
  private observePaintControlsClose(): void {
    this.closeObserver?.disconnect();

    // NOTE: renderSaveButton() 自体がDOMを書き換えるため、
    // 無条件に呼ぶと observer が自分の変更で再発火し続ける(強制リフロー多発)。
    // 「保存ボタンが消えた時だけ」再生成することでループを断つ。
    const observer = new MutationObserver(() => {
      if (findPaintPixelControls()) {
        if (!document.getElementById(SAVE_BUTTON_ID)) this.renderSaveButton();
        return;
      }

      document.getElementById(SAVE_BUTTON_ID)?.remove();
      observer.disconnect();
      this.closeObserver = null;
      // inject 側もセッション終了で mode OFF + 下書き破棄される
      this.enabled = false;
      this.pixelCount = 0;
      this.savedKey = null;
      this.seedItem = null;
      // モーダルごと消えるので復元不要。次回セッションで探し直す
      this.hiddenSubmitButton = null;
      this.submitContainer = null;
    });

    observer.observe(document.body, { childList: true, subtree: true });
    this.closeObserver = observer;
  }

  /**
   * 下書きモード中は wplace の確定ボタンを隠し、保存ボタンに差し替える。
   * 誤送信の導線そのものを消すのが目的。
   */
  private renderSaveButton(): void {
    if (!this.enabled) {
      // 隠した確定ボタンを戻す (display:none にすると再検索で見つからないので保持参照を使う)
      if (this.hiddenSubmitButton) {
        this.hiddenSubmitButton.style.display = "";
        this.hiddenSubmitButton = null;
      }
      document.getElementById(SAVE_BUTTON_ID)?.remove();
      return;
    }

    let saveButton = document.getElementById(
      SAVE_BUTTON_ID,
    ) as HTMLButtonElement | null;

    // 初回のみ確定ボタンを探して隠す。
    // 一度隠すと offsetParent が null になり再検索できないため参照を保持する。
    if (!this.hiddenSubmitButton) {
      const submitButton = findPaintSubmitButton();
      if (!submitButton) return;

      this.hiddenSubmitButton = submitButton;
      this.submitContainer = submitButton.parentElement;
      submitButton.style.display = "none";
    }

    const container = this.submitContainer;
    if (!container) return;

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

    const label = this.savedKey ? t`${"draft_update"}` : t`${"draft_save"}`;
    saveButton.innerHTML = `<div class="flex items-center gap-1.5">${ICON_SVG}<span>${label}${
      this.pixelCount > 0 ? ` (${this.pixelCount})` : ""
    }</span></div>`;
  }

  /** 下書きを gallery へ保存 (2回目以降は同じitemを更新) */
  private async save(): Promise<void> {
    if (this.saving || this.pixelCount === 0) return;
    this.saving = true;
    this.renderSaveButton();

    try {
      const result = await requestDraftExport();
      if (!result) {
        Toast.show(t`${"draft_save_failed"}`, "error");
        return;
      }

      // 既存keyがあれば同じitemを上書き = 下書き画像の更新
      const key = this.savedKey ?? `${SAVED_KEY_PREFIX}${Date.now()}`;
      // 下書き編集(既存item)なら title 等を引き継ぐ。新規下書きなら生成する
      const title =
        this.seedItem?.title ||
        `${t`${"draft_mode"}`} ${new Date().toLocaleString()}`;
      await new GalleryStorage().save({
        ...this.seedItem,
        key,
        timestamp: Date.now(),
        dataUrl: result.dataUrl,
        title,
        drawPosition: result.coords,
        drawEnabled: true,
        width: result.width,
        height: result.height,
      });
      await sendGalleryImagesToInject();

      this.savedKey = key;
      Toast.show(t`${"saved_to_gallery"}`, "success");
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save draft:", error);
      Toast.show(t`${"draft_save_failed"}`, "error");
    } finally {
      this.saving = false;
      this.renderSaveButton();
    }
  }
}

/** 実行中の DraftDraw インスタンス (initializer が1つだけ生成する) */
let activeInstance: DraftDraw | null = null;

/**
 * gallery 側から「下書き編集」を開始するための公開関数。
 * DraftDraw は DI に登録されていないため、モジュール直下の関数として公開する。
 */
export const enterDraftEditForItem = async (
  item: GalleryItem,
): Promise<void> => {
  if (!activeInstance) {
    Toast.show(t`${"draft_enter_failed"}`, "error");
    return;
  }
  await activeInstance.enterDraftEditForItem(item);
};
