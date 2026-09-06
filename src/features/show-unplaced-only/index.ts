import {
  registerPaintToolbarButton,
  setPaintToolbarButtonActive,
} from "@/features/paint-toolbar";
import { sendShowUnplacedOnlyToInject } from "@/content";
import { SHOW_UNPLACED_ONLY_ICON_SVG } from "@/assets/enhanced-mode-icons";
import {
  loadShowUnplacedOnlyFromStorage,
  getShowUnplacedOnly,
  setShowUnplacedOnly,
  subscribeShowUnplacedOnly,
} from "@/states/showUnplacedOnly";
import { t } from "@/i18n";
import { showFeatureHint } from "@/features/feature-hints";

export class ShowUnplacedOnly {
  private button: HTMLButtonElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await loadShowUnplacedOnlyFromStorage();
    const enabled = getShowUnplacedOnly();

    // Subscribe to state changes
    this.unsubscribe = subscribeShowUnplacedOnly((enabled) => {
      this.updateButton(enabled);
    });

    // Send initial state to inject
    sendShowUnplacedOnlyToInject(enabled);

    this.setupUI();
  }

  private setupUI(): void {
    registerPaintToolbarButton({
      id: "show-unplaced-only-btn",
      tip: t("show_unplaced_only"),
      icon: SHOW_UNPLACED_ONLY_ICON_SVG,
      className: "btn btn-square btn-sm",
      isActive: getShowUnplacedOnly,
      onClick: () => void this.toggle(),
      onCreate: (button) => {
        this.button = button;
        showFeatureHint("show-unplaced-only", button);
        console.log("🧑‍🎨 : Show unplaced only button added");
      },
    });
  }

  private updateButton(enabled: boolean): void {
    if (this.button) setPaintToolbarButtonActive(this.button, enabled);
  }

  async toggle(): Promise<void> {
    const newState = !getShowUnplacedOnly();
    await setShowUnplacedOnly(newState);
    sendShowUnplacedOnlyToInject(newState);
    console.log("🧑‍🎨 : Show unplaced only toggled:", newState);
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
