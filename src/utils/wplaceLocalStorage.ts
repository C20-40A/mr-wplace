import { Position } from "../features/bookmark/types";

export class WplaceLocalStorage {
  private static readonly LOCATION_KEY = "location";
  private static readonly SELECTED_COLOR_KEY = "selected-color";

  private static getValue(key: string): any {
    return window.localStorage.getItem(key);
  }

  public static getClickedPosition(): Position | null {
    const stored = this.getValue(this.LOCATION_KEY);
    console.log("Retrieved stored position:", stored);
    console.log("JSON parse result:", stored ? JSON.parse(stored) : null);
    return stored ? JSON.parse(stored) : null;
  }

  public static getSelectedColor(): string | null {
    const stored = this.getValue(this.SELECTED_COLOR_KEY);
    return stored ? stored : null;
  }
}
