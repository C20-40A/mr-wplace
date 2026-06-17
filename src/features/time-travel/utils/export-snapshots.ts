import { runtime } from "@/utils/browser-api";
import { Toast } from "@/components/toast";
import { t } from "@/i18n/manager";
import {
  exportSnapshots,
  type SnapshotExportScope,
} from "@/utils/inject-bridge";

const WORKER_PATH = "dist/inject/workers/snapshot-export.worker.js";

/**
 * Trigger a snapshot export (all or per-tile) via the inject Worker.
 * Disables the button and streams progress into its label, restoring it after.
 */
export const runSnapshotExport = async (
  button: HTMLButtonElement,
  scope: SnapshotExportScope,
): Promise<void> => {
  if (button.disabled) return;

  const labelEl = button.querySelector("span") ?? button;
  const originalLabel = labelEl.textContent ?? "";
  button.disabled = true;

  const setLabel = (text: string) => {
    labelEl.textContent = text;
  };

  setLabel(t`${"exporting"}`);

  try {
    const workerUrl = runtime.getURL(WORKER_PATH);
    const result = await exportSnapshots(workerUrl, scope, (progress) => {
      if (progress.phase === "read") {
        setLabel(`${progress.current}/${progress.total}`);
      } else {
        setLabel(`${Math.round(progress.percent)}%`);
      }
    });

    if (result.status === "empty") {
      Toast.error(t`${"no_snapshots_to_export"}`);
      return;
    }
    Toast.success(t`${"download_success"}`);
  } catch (error) {
    console.error("🧑‍🎨 : Snapshot export failed", error);
    Toast.error(t`${"export_failed"}`);
  } finally {
    setLabel(originalLabel);
    button.disabled = false;
  }
};
