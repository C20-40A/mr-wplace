import {
  showHintTooltipOnce,
  type HintPlacement,
} from "@/components/hint-tooltip";
import { t } from "@/i18n/manager";
import { isFeatureHintDismissed } from "@/states/feature-hints";

export type FeatureHintId =
  | "paint-pixel-icon"
  | "show-unplaced-only"
  | "color-isolate"
  | "data-saver"
  | "overlay-mode-independent";

interface FeatureHintDefinition {
  messageKey?: string;
  getMessage?: () => string;
  placement: HintPlacement;
}

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
  "paint-pixel-icon": {
    messageKey: "hint_palette_toggle",
    placement: "top",
  },
  "show-unplaced-only": {
    messageKey: "hint_show_unplaced_only",
    placement: "top",
  },
  "color-isolate": {
    messageKey: "hint_color_isolate",
    placement: "top",
  },
  "data-saver": {
    messageKey: "hint_data_saver",
    placement: "left",
  },
  "overlay-mode-independent": {
    getMessage: () =>
      `${t("hint_overlay_mode_independent_prefix")}「${t("popup_overlay_mode_layer")}」${t("hint_overlay_mode_independent_suffix")}`,
    placement: "top",
  },
};

const HINT_DEPENDENCIES: Partial<Record<FeatureHintId, FeatureHintId>> = {
  "color-isolate": "paint-pixel-icon",
};

const waitForDependencyAndShow = async (
  hintId: FeatureHintId,
  target: HTMLElement,
  retryCount = 0,
): Promise<void> => {
  if (!target.isConnected) return;

  const dependencyId = HINT_DEPENDENCIES[hintId];
  if (dependencyId) {
    const dependencyDismissed = await isFeatureHintDismissed(dependencyId);
    if (!dependencyDismissed) {
      if (retryCount >= 60) return;
      window.setTimeout(() => {
        void waitForDependencyAndShow(hintId, target, retryCount + 1);
      }, 300);
      return;
    }
  }

  const definition = HINT_DEFINITIONS[hintId];
  if (!definition) return;
  const message = definition.getMessage?.();
  if (!message && !definition.messageKey) return;

  void showHintTooltipOnce({
    id: hintId,
    target,
    message: message ?? t(definition.messageKey!),
    placement: definition.placement,
  });
};

export const showFeatureHint = (
  hintId: FeatureHintId,
  target: HTMLElement,
): void => {
  void waitForDependencyAndShow(hintId, target);
};
