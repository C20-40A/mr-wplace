import { Router } from "../../utils/router";

export type TimeTravelRoute = "current-position" | "tile-list" | "tile-snapshots" | "snapshot-detail" | "snapshot-share" | "import-snapshot" | "tile-merge" | "tile-statistics" | "tmp-tile-board";

export class TimeTravelRouter extends Router<TimeTravelRoute> {
  constructor() {
    const titleMap: Record<TimeTravelRoute, string> = {
      "current-position": "timetravel_current_position",
      "tile-list": "timetravel_tile_list",
      "tile-snapshots": "timetravel_tile_snapshots",
      "snapshot-detail": "snapshot_detail",
      "snapshot-share": "snapshot_share",
      "import-snapshot": "import",
      "tile-merge": "tile_merge",
      "tile-statistics": "tile_statistics",
      "tmp-tile-board": "tile_merge",
    };
    super("current-position", titleMap);
  }
}
