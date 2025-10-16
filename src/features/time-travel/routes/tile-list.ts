import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, TileSnapshotInfo } from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "../../../i18n/manager";
import { createCard, CardConfig } from "../../../components/card";

export class TileListRoute {
  render(container: HTMLElement, router: TimeTravelRouter): void {
    container.innerHTML = t`
      <div class="mb-2">
        <button id="wps-import-snapshot-btn" class="btn btn-sm btn-neutral">
          ${"import"}
        </button>
      </div>
      <div style="overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.5rem; min-height: 400px;">
        <div id="wps-tile-list" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <div class="text-sm text-gray-500 text-center p-4" style="grid-column: 1 / -1;">${"loading"}</div>
        </div>
      </div>
    `;

    this.setupEvents(container, router);
    this.loadTileList(container);
  }

  private setupEvents(container: HTMLElement, router: TimeTravelRouter): void {
    // Import button event
    container
      .querySelector("#wps-import-snapshot-btn")
      ?.addEventListener("click", () => {
        router.navigate("import-snapshot");
      });

    // Tile list click events
    container
      .querySelector("#wps-tile-list")
      ?.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tileCard = target.closest(".wps-card") as HTMLElement | null;

        if (tileCard?.dataset.tileX && tileCard?.dataset.tileY) {
          const tileX = parseInt(tileCard.dataset.tileX);
          const tileY = parseInt(tileCard.dataset.tileY);
          (router as any).selectedTile = { tileX, tileY };
          router.navigate("tile-snapshots");
        }
      });
  }

  private async loadTileList(container: HTMLElement): Promise<void> {
    try {
      const tiles = await TimeTravelStorage.getAllTilesWithSnapshots();

      // 名称一括取得（効率化）
      const tileNames = await TileNameStorage.getTileNames(
        tiles.map((t) => ({ tileX: t.tileX, tileY: t.tileY }))
      );

      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        if (tiles.length === 0) {
          listContainer.innerHTML = `<div class="text-sm text-gray-500 text-center p-4" style="grid-column: 1 / -1;">${t`${"no_items"}`}</div>`;
        } else {
          const renderedTiles = await Promise.all(
            tiles.map((tile) => this.renderTileCard(tile, tileNames))
          );
          listContainer.innerHTML = renderedTiles.join("");
        }
      }
    } catch (error) {
      console.error("🧑‍🎨 : Failed to load tile list:", error);
      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4" style="grid-column: 1 / -1;">Failed to load tiles</div>`;
      }
    }
  }

  private async renderTileCard(
    tile: TileSnapshotInfo,
    tileNames: Map<string, string>
  ): Promise<string> {
    const activeSnapshot = await TimeTravelStorage.getActiveSnapshotForTile(
      tile.tileX,
      tile.tileY
    );

    const nameKey = `${tile.tileX}_${tile.tileY}`;
    const tileName = tileNames.get(nameKey);
    const displayName = tileName || `Tile(${tile.tileX}, ${tile.tileY})`;

    const cardConfig: CardConfig = {
      id: `${tile.tileX}_${tile.tileY}`,
      title: displayName,
      subtitle: `📍${tile.tileX}, ${tile.tileY}`,
      badge: `Total: ${tile.count}`,
      hasActiveIcon: !!activeSnapshot,
      onClick: true,
      data: {
        "tile-x": tile.tileX.toString(),
        "tile-y": tile.tileY.toString(),
      },
    };

    return createCard(cardConfig);
  }
}
