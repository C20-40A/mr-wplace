/**
 * Migration Modal
 *
 * シンプルなプログレス表示モーダル
 * - "Migrating... 3/10" 形式で進捗表示
 * - 完了後 "Complete!" → 0.8秒後に自動で閉じる
 */

export interface MigrationProgress {
  current: number;
  total: number;
  currentItem?: string;
}

export class MigrationModal {
  private modal: HTMLDialogElement | null = null;
  private statusElement: HTMLElement | null = null;
  private progressElement: HTMLElement | null = null;

  /**
   * モーダルを表示
   */
  show(): void {
    if (this.modal) return;

    this.modal = document.createElement("dialog");
    this.modal.className = "modal modal-open";
    this.modal.style.cssText = "z-index: 9999;";
    this.modal.innerHTML = `
      <div class="modal-box" style="max-width: 320px; text-align: center;">
        <h3 class="font-bold text-lg mb-4">Mr. Wplace</h3>
        <div id="migration-status" class="text-sm mb-2">Preparing migration...</div>
        <div id="migration-progress" class="text-xs text-base-content/60"></div>
        <progress class="progress progress-primary w-full mt-4" id="migration-progress-bar" value="0" max="100"></progress>
        <button id="migration-force-close" class="btn btn-ghost btn-xs mt-4 opacity-0" style="transition: opacity 0.3s;">Force Close</button>
      </div>
    `;

    // Show force close button after 10 seconds (safety mechanism)
    setTimeout(() => {
      const forceCloseBtn = this.modal?.querySelector("#migration-force-close") as HTMLButtonElement;
      if (forceCloseBtn) {
        forceCloseBtn.style.opacity = "1";
        forceCloseBtn.onclick = () => this.close();
      }
    }, 10000);

    document.body.appendChild(this.modal);
    this.statusElement = this.modal.querySelector("#migration-status");
    this.progressElement = this.modal.querySelector("#migration-progress");

    this.modal.showModal();
  }

  /**
   * 進捗を更新
   */
  updateProgress(progress: MigrationProgress): void {
    if (!this.statusElement || !this.progressElement || !this.modal) return;

    const percent =
      progress.total > 0
        ? Math.round((progress.current / progress.total) * 100)
        : 0;

    this.statusElement.textContent = `Migrating... ${progress.current}/${progress.total}`;

    if (progress.currentItem) {
      this.progressElement.textContent = progress.currentItem;
    }

    const progressBar = this.modal.querySelector(
      "#migration-progress-bar"
    ) as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = percent;
    }
  }

  /**
   * 完了表示して0.8秒後に閉じる
   */
  async complete(): Promise<void> {
    if (!this.statusElement || !this.progressElement || !this.modal) return;

    this.statusElement.textContent = "Complete!";
    this.progressElement.textContent = "";

    const progressBar = this.modal.querySelector(
      "#migration-progress-bar"
    ) as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = 100;
      progressBar.classList.remove("progress-primary");
      progressBar.classList.add("progress-success");
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
    this.close();
  }

  /**
   * エラー表示
   */
  showError(message: string): void {
    if (!this.statusElement || !this.progressElement) return;

    this.statusElement.textContent = "Migration failed";
    this.progressElement.textContent = message;
    this.progressElement.classList.add("text-error");

    const progressBar = this.modal?.querySelector(
      "#migration-progress-bar"
    ) as HTMLProgressElement;
    if (progressBar) {
      progressBar.classList.remove("progress-primary");
      progressBar.classList.add("progress-error");
    }
  }

  /**
   * モーダルを閉じる
   */
  close(): void {
    if (!this.modal) return;

    this.modal.close();
    this.modal.remove();
    this.modal = null;
    this.statusElement = null;
    this.progressElement = null;
  }

  /**
   * スキップ表示（migration不要の場合）
   */
  async showSkipped(): Promise<void> {
    if (!this.statusElement || !this.progressElement || !this.modal) return;

    this.statusElement.textContent = "No migration needed";
    this.progressElement.textContent = "";

    const progressBar = this.modal.querySelector(
      "#migration-progress-bar"
    ) as HTMLProgressElement;
    if (progressBar) {
      progressBar.value = 100;
      progressBar.classList.remove("progress-primary");
      progressBar.classList.add("progress-success");
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    this.close();
  }
}
