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
