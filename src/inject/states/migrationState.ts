import type { LayerRepository } from "../db/layer-repository";
import type { WorkerMessenger } from "../workers/messaging";

/**
 * Migration architecture state (LayerRepository + WorkerMessenger)
 */
interface MigrationState {
  layerRepository: LayerRepository | null;
  workerMessenger: WorkerMessenger | null;
}

let migrationState: MigrationState = {
  layerRepository: null,
  workerMessenger: null,
};

/**
 * Get LayerRepository instance
 */
export const getLayerRepository = (): LayerRepository | null =>
  migrationState.layerRepository;

/**
 * Get WorkerMessenger instance
 */
export const getWorkerMessenger = (): WorkerMessenger | null =>
  migrationState.workerMessenger;

/**
 * Set migration architecture instances (called from inject/index.ts)
 */
export const setMigrationArchitecture = (
  repository: LayerRepository,
  messenger: WorkerMessenger
): void => {
  migrationState.layerRepository = repository;
  migrationState.workerMessenger = messenger;
  console.log("🧑‍🎨 : Migration architecture set in state");
};

/**
 * Request Worker migration for a layer
 */
export const requestWorkerMigration = (
  layerId: string,
  options: {
    priority: number;
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    bounds: { top: number; left: number; right: number; bottom: number };
  }
): void => {
  const messenger = migrationState.workerMessenger;

  if (!messenger) {
    console.warn("🧑‍🎨 : WorkerMessenger not initialized, skipping migration");
    return;
  }

  messenger.requestMigration(layerId, options.priority, options.coords, options.bounds);
  console.log(`🧑‍🎨 : Requested migration for ${layerId} (priority: ${options.priority})`);
};
