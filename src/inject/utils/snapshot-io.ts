/**
 * Snapshot Export (inject side)
 *
 * Spawns the snapshot-export Worker to build a ZIP off the main thread,
 * then triggers the download. Progress is forwarded to content.
 *
 * NOTE: inject runs in page origin and cannot use chrome.runtime.getURL.
 * The bundled worker URL is passed from content; we fetch it and create a
 * Blob URL so the Worker can be instantiated under page CSP.
 */

export type SnapshotExportScope =
  | { scope: "all" }
  | { scope: "tile"; tileX: number; tileY: number };

type ProgressMessage =
  | { type: "progress"; phase: "read"; current: number; total: number }
  | { type: "progress"; phase: "pack"; percent: number };

type WorkerMessage =
  | ProgressMessage
  | { type: "done"; blob: Blob; count: number }
  | { type: "empty" }
  | { type: "error"; error: string };

export interface SnapshotExportCallbacks {
  onProgress?: (progress: ProgressMessage) => void;
}

const buildZipFilename = (scope: SnapshotExportScope): string => {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (scope.scope === "tile")
    return `wplace_snapshots_${scope.tileX}-${scope.tileY}_${ts}.zip`;
  return `wplace_snapshots_${ts}.zip`;
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Run a snapshot export via Worker and download the resulting ZIP.
 * @returns { status, count } - "empty" when no snapshots matched
 */
export const exportSnapshotsToZip = async (
  workerUrl: string,
  scope: SnapshotExportScope,
  callbacks?: SnapshotExportCallbacks,
): Promise<{ status: "done" | "empty"; count: number }> => {
  // Fetch the bundled worker and wrap in a Blob URL (page CSP friendly)
  const res = await fetch(workerUrl);
  const workerSource = await res.text();
  const blobUrl = URL.createObjectURL(
    new Blob([workerSource], { type: "text/javascript" }),
  );

  const worker = new Worker(blobUrl);

  try {
    return await new Promise<{ status: "done" | "empty"; count: number }>(
      (resolve, reject) => {
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const data = event.data;

          if (data.type === "progress") {
            callbacks?.onProgress?.(data);
            return;
          }

          if (data.type === "done") {
            downloadBlob(data.blob, buildZipFilename(scope));
            resolve({ status: "done", count: data.count });
            return;
          }

          if (data.type === "empty") {
            resolve({ status: "empty", count: 0 });
            return;
          }

          reject(new Error(data.error));
        };

        worker.onerror = (event) =>
          reject(new Error(event.message || "Snapshot export worker error"));

        worker.postMessage(scope);
      },
    );
  } finally {
    worker.terminate();
    URL.revokeObjectURL(blobUrl);
  }
};
