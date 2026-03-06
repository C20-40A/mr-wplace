import { findMyLocationButton } from "@/constants/selectors";
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
    const observer = new MutationObserver(() => this.hide());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  private hide(): void {
    const btn = findMyLocationButton();
    if (btn) (btn as HTMLElement).style.display = "none";
  }
}
