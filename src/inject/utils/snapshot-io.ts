/**
 * Snapshot Export (inject side)
 *
 * Builds a ZIP off the main thread via the snapshot-export Worker and downloads it.
 * See zip-export-worker.ts for the shared Worker runner.
 */

import {
  runZipExportWorker,
  type ZipExportProgress,
  type ZipExportResult,
} from "./zip-export-worker";

export type SnapshotExportScope =
  | { scope: "all" }
  | { scope: "tile"; tileX: number; tileY: number };

export interface SnapshotExportCallbacks {
  onProgress?: (progress: ZipExportProgress) => void;
}

const buildZipFilename = (scope: SnapshotExportScope): string => {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (scope.scope === "tile")
    return `wplace_snapshots_${scope.tileX}-${scope.tileY}_${ts}.zip`;
  return `wplace_snapshots_${ts}.zip`;
};

/**
 * Run a snapshot export via Worker and download the resulting ZIP.
 * @returns { status, count } - "empty" when no snapshots matched
 */
export const exportSnapshotsToZip = (
  workerUrl: string,
  scope: SnapshotExportScope,
  callbacks?: SnapshotExportCallbacks,
): Promise<ZipExportResult> =>
  runZipExportWorker(
    workerUrl,
    scope,
    buildZipFilename(scope),
    callbacks?.onProgress,
  );
