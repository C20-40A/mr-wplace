import { showHintTooltipOnce, type HintPlacement } from "@/components/hint-tooltip";
import { t } from "@/i18n/manager";

export type FeatureHintId =
  | "show-unplaced-only"
  | "color-isolate"
  | "data-saver";

interface FeatureHintDefinition {
  messageKey: string;
  placement: HintPlacement;
}

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
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
};

export const showFeatureHint = (
  hintId: FeatureHintId,
  target: HTMLElement,
): void => {
  const definition = HINT_DEFINITIONS[hintId];
  if (!definition) return;

  void showHintTooltipOnce({
    id: hintId,
    target,
    message: t(definition.messageKey),
    placement: definition.placement,
  });
};
