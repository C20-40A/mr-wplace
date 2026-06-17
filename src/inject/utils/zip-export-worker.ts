/**
 * ZIP Export Worker runner (inject side, shared)
 *
 * Spawns a bundled export Worker to build a ZIP off the main thread, then
 * triggers the download. Progress is forwarded via the onProgress callback.
 *
 * NOTE: inject runs in page origin and cannot use chrome.runtime.getURL.
 * The bundled worker URL is passed from content; we fetch it and create a
 * Blob URL so the Worker can be instantiated under page CSP.
 */

export type ZipExportProgress =
  | { type: "progress"; phase: "read"; current: number; total: number }
  | { type: "progress"; phase: "pack"; percent: number };

type WorkerMessage =
  | ZipExportProgress
  | { type: "done"; blob: Blob; count: number }
  | { type: "empty" }
  | { type: "error"; error: string };

export interface ZipExportResult {
  status: "done" | "empty";
  count: number;
}

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
 * Run a ZIP export via Worker and download the result.
 *
 * @param workerUrl - bundled worker URL (from content runtime.getURL)
 * @param request - payload posted to the worker (scope info, etc.)
 * @param filename - download filename for the resulting ZIP
 * @param onProgress - optional progress callback
 */
export const runZipExportWorker = async (
  workerUrl: string,
  request: unknown,
  filename: string,
  onProgress?: (progress: ZipExportProgress) => void,
): Promise<ZipExportResult> => {
  // Fetch the bundled worker and wrap in a Blob URL (page CSP friendly)
  const res = await fetch(workerUrl);
  const workerSource = await res.text();
  const blobUrl = URL.createObjectURL(
    new Blob([workerSource], { type: "text/javascript" }),
  );

  const worker = new Worker(blobUrl);

  try {
    return await new Promise<ZipExportResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;

        if (data.type === "progress") {
          onProgress?.(data);
          return;
        }
        if (data.type === "done") {
          downloadBlob(data.blob, filename);
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
        reject(new Error(event.message || "Export worker error"));

      worker.postMessage(request);
    });
  } finally {
    worker.terminate();
    URL.revokeObjectURL(blobUrl);
  }
};
