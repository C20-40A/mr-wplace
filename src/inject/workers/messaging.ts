/**
 * Type-safe messaging helper for Worker communication
 * Phase 1.3: Communication Protocol
 */

// Worker request types
export interface MigrateRequestData {
  layerId: string;
  priority: 0 | 1; // 0 = high priority (visible), 1 = low priority (background)
  coords: {
    TLX: number;
    TLY: number;
    PxX: number;
    PxY: number;
  };
  bounds: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

export type WorkerRequest =
  | { type: 'MIGRATE_REQUEST'; data: MigrateRequestData }
  | { type: 'CANCEL_MIGRATION'; data: { layerId: string } };

// Worker response types
export interface MigrationCompleteResponse {
  type: 'MIGRATION_COMPLETE';
  layerId: string;
  success: boolean;
  error?: string;
  stats?: {
    tileCount: number;
    processingTime: number;
  };
}

export interface MigrationProgressResponse {
  type: 'MIGRATION_PROGRESS';
  layerId: string;
  progress: number; // 0-100
  currentTile: string;
}

export type WorkerResponse = MigrationCompleteResponse | MigrationProgressResponse;

/**
 * Type-safe Worker messenger
 */
export class WorkerMessenger {
  private worker: Worker;
  private listeners: Map<string, Set<(data: WorkerResponse) => void>> = new Map();

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Send a request to the worker
   */
  send(request: WorkerRequest): void {
    this.worker.postMessage(request);
    console.log('🧑‍🎨 : [Worker →]', request.type, request.data);
  }

  /**
   * Wait for a specific response type from the worker
   */
  async waitFor<T extends WorkerResponse['type']>(
    type: T,
    timeout = 30000
  ): Promise<Extract<WorkerResponse, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(type, handler);
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);

      const handler = (data: WorkerResponse) => {
        if (data.type === type) {
          clearTimeout(timer);
          this.off(type, handler);
          resolve(data as Extract<WorkerResponse, { type: T }>);
        }
      };

      this.on(type, handler);
    });
  }

  /**
   * Wait for a specific layer's migration to complete
   */
  async waitForMigrationComplete(
    layerId: string,
    timeout = 60000
  ): Promise<MigrationCompleteResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off('MIGRATION_COMPLETE', handler);
        reject(new Error(`Timeout waiting for migration of ${layerId}`));
      }, timeout);

      const handler = (data: WorkerResponse) => {
        if (data.type === 'MIGRATION_COMPLETE' && data.layerId === layerId) {
          clearTimeout(timer);
          this.off('MIGRATION_COMPLETE', handler);
          resolve(data);
        }
      };

      this.on('MIGRATION_COMPLETE', handler);
    });
  }

  /**
   * Add a listener for a specific message type
   */
  on(type: string, handler: (data: WorkerResponse) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(handler);
  }

  /**
   * Remove a listener for a specific message type
   */
  off(type: string, handler: (data: WorkerResponse) => void): void {
    const listeners = this.listeners.get(type);

    if (listeners) {
      listeners.delete(handler);
    }
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Terminate the worker and clean up
   */
  terminate(): void {
    this.removeAllListeners();
    this.worker.terminate();
  }

  /**
   * Handle messages from worker
   */
  private handleMessage(event: MessageEvent): void {
    const response: WorkerResponse = event.data;

    console.log('🧑‍🎨 : [Worker ←]', response.type, response);

    const listeners = this.listeners.get(response.type);

    if (listeners) {
      for (const listener of listeners) {
        listener(response);
      }
    }
  }
}

/**
 * Create a migration worker instance
 */
export const createMigrationWorker = (): Worker => {
  const worker = new Worker(
    new URL('./migration.worker.ts', import.meta.url),
    { type: 'module' }
  );

  console.log('🧑‍🎨 : Migration worker created');

  return worker;
};
