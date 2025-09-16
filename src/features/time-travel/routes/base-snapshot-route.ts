import { TimeTravelStorage, SnapshotInfo } from "../storage";
import { Toast } from "../../../components/toast";
import { t } from "../../../i18n/manager";
import { I18nManager } from "../../../i18n/manager";

export abstract class BaseSnapshotRoute {
  protected setupSnapshotEvents(
    container: HTMLElement,
    listSelector: string
  ): void {
    container
      .querySelector(listSelector)
      ?.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const deleteBtn = target.closest(
          ".wps-delete-btn"
        ) as HTMLElement | null;
        const snapshotItem = target.closest(
          ".wps-snapshot-item"
        ) as HTMLElement | null;

        if (deleteBtn?.dataset.snapshotKey) {
          e.stopPropagation();
          await this.deleteSnapshot(deleteBtn.dataset.snapshotKey, container);
        } else if (snapshotItem?.dataset.snapshotKey) {
          await this.navigateToDetail(snapshotItem.dataset.snapshotKey);
        }
      });
  }

  protected renderSnapshotItem(snapshot: SnapshotInfo): string {
    const locale = I18nManager.getCurrentLocale();
    const localeString = locale === "ja" ? "ja-JP" : "en-US";
    const timeFormat = {
      year: "numeric" as const,
      month: "2-digit" as const,
      day: "2-digit" as const,
      hour: "2-digit" as const,
      minute: "2-digit" as const,
    };
    const formattedTime = new Date(snapshot.timestamp).toLocaleString(
      localeString,
      timeFormat
    );

    return `
      <div class="border-b wps-snapshot-item cursor-pointer hover:bg-gray-50" data-snapshot-key="${snapshot.fullKey}" style="position: relative;">
        <div class="p-3">
          <div class="text-sm font-medium">${formattedTime}</div>
          <div class="text-xs" style="color: #9ca3af;">${snapshot.id}</div>
        </div>
        <button class="wps-delete-btn" data-snapshot-key="${snapshot.fullKey}" style="position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border: none; background: grey; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer;">×</button>
      </div>
    `;
  }

  protected async deleteSnapshot(
    fullKey: string,
    container: HTMLElement
  ): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;
    await TimeTravelStorage.removeSnapshotFromIndex(fullKey);
    Toast.success(t`${"deleted_message"}`);
    await this.reloadSnapshots(container);
  }

  protected async navigateToDetail(fullKey: string): Promise<void> {
    const timeTravel = (window as any).wplaceStudio?.timeTravel;
    if (timeTravel?.router) {
      (timeTravel.router as any).selectedSnapshot = { fullKey };
      timeTravel.router.navigate("snapshot-detail");
    }
  }

  protected abstract reloadSnapshots(container: HTMLElement): Promise<void>;
}
