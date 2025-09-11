import { Router } from "../../utils/router";

export type TimeTravelRoute = "current-position" | "tile-list" | "tile-snapshots";

export class TimeTravelRouter extends Router<TimeTravelRoute> {
  constructor() {
    super("current-position");
  }

  canNavigateBack(): boolean {
    return super.canNavigateBack("current-position");
  }

  navigateBack(): void {
    super.navigateBack("current-position");
  }
}
