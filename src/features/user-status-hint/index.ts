import { setupElementObserver } from "@/components/element-observer";
import { showFeatureHint } from "@/features/feature-hints";

const findUserStatusContainer = (): HTMLElement | null => {
  const container = document.getElementById("user-status-container");
  if (!(container instanceof HTMLElement)) return null;
  return container;
};

export class UserStatusHint {
  constructor() {
    this.init();
  }

  private init(): void {
    setupElementObserver([
      {
        id: "user-status-container",
        getTargetElement: findUserStatusContainer,
        createElement: (container) => {
          if (!(container instanceof HTMLElement)) return;
          showFeatureHint("user-status-container", container);
        },
      },
    ]);
  }
}
