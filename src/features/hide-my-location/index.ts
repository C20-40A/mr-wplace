import { findMyLocationButton } from "@/constants/selectors";
import { onDomChange } from "@/utils/dom-change";
import {
  loadHideMyLocationFromStorage,
  getHideMyLocation,
} from "@/states/hide-my-location";

export class HideMyLocation {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await loadHideMyLocationFromStorage();
    if (!getHideMyLocation()) return;

    this.hide();
    onDomChange(() => this.hide());
  }

  private hide(): void {
    const btn = findMyLocationButton();
    if (btn) (btn as HTMLElement).style.display = "none";
  }
}
