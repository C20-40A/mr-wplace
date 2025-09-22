import { Router } from "../../utils/router";

export type TimeTravelRoute = "current-position" | "tile-list" | "tile-snapshots" | "snapshot-detail" | "import-snapshot";

export class TimeTravelRouter extends Router<TimeTravelRoute> {
  constructor() {
    const titleMap: Record<TimeTravelRoute, string> = {
      "current-position": "timetravel_current_position",
      "tile-list": "timetravel_tile_list",
      "tile-snapshots": "timetravel_tile_snapshots",
      "snapshot-detail": "snapshot_detail",
      "import-snapshot": "import",
    };
    super("current-position", titleMap);
  }
}
