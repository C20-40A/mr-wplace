import {
  hasActiveHintTooltip,
  showHintTooltipOnce,
  type HintPlacement,
} from "@/components/hint-tooltip";
import { hasOpenModal } from "@/components/modal";
import { t } from "@/i18n/manager";
import { isFeatureHintDismissed } from "@/states/feature-hints";

export type FeatureHintId =
  | "paint-pixel-icon"
  | "gallery-btn"
  | "drawing-btn"
  | "unplaced-item"
  | "show-unplaced-only"
  | "color-isolate"
  | "data-saver"
  | "overlay-mode-independent"
  | "user-status-container";

interface FeatureHintDefinition {
  messageKey?: string;
  getMessage?: () => string;
  iconSrc?: string;
  placement: HintPlacement;
  priority?: number;
  dependsOn?: FeatureHintId[];
  condition?: () => boolean | Promise<boolean>;
}

const DEFAULT_HINT_PRIORITY = 1000;

const HINT_DIALOG_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA8UlEQVR42t2WbQrDIAyGc5D+3DG8/216BkdhjkzefNnEsQmCYmuevDFRoj9u/dVLNrU6+j7PeGvtY8znc2drWzzXoPYYN8KxZhx5hJoTZM3zAeBpzGC+9MhTQQEqi39AgZzUs2KsrNdAoDGfZ1fAkPQVAMQ3/hqApoSSJTUqOOp+unHyZENFBkAABKHcinXZsFsFNf8rpSd0+g1FqLwQXfPzeFiX0X3D0jtgBsg8A2Juz4YkBVafY2ZxQSFwqOAC8Va3uwA9FG/r7pcA0D7W87xbEOgsDIAB4QToYQAJSgJA/2gAkR/dAA4nfgSgKARviCcq6ovGz9NsNQAAAABJRU5ErkJggg==";

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
  // ------- Main Screen Hint -------
  "gallery-btn": {
    messageKey: "hint_gallery_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "right",
    priority: 1,
  },
  "user-status-container": {
    messageKey: "hint_user_status_container",
    iconSrc: HINT_DIALOG_ICON,
    placement: "bottom",
    condition: () => !hasOpenModal(),
    priority: 2,
  },
  // ------- Drawing Hints -------
  "drawing-btn": {
    messageKey: "hint_drawing_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["gallery-btn"],
  },
  "unplaced-item": {
    messageKey: "hint_unplaced_grid",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["drawing-btn"],
  },
  // ------- Paint Modal Hints -------
  "paint-pixel-icon": {
    messageKey: "hint_palette_toggle",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    priority: 1,
    dependsOn: ["unplaced-item"],
  },
  "color-isolate": {
    messageKey: "hint_color_isolate",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    priority: 2,
    dependsOn: ["unplaced-item"],
  },
  "show-unplaced-only": {
    messageKey: "hint_show_unplaced_only",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    priority: 3,
    dependsOn: ["unplaced-item"],
  },
  // ------- Main Screen Hint -------
  "data-saver": {
    messageKey: "hint_data_saver",
    iconSrc: HINT_DIALOG_ICON,
    placement: "left",
    dependsOn: ["color-isolate"],
    condition: () => !hasOpenModal(),
  },
  "overlay-mode-independent": {
    getMessage: () =>
      `${t("hint_overlay_mode_independent_prefix")}「${t("popup_overlay_mode_layer")}」${t("hint_overlay_mode_independent_suffix")}`,
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["show-unplaced-only"],
  },
};

const pendingHints = new Map<FeatureHintId, HTMLElement>();
let isEvaluating = false;
let shouldEvaluateAgain = false;

const getHintPriority = (hintId: FeatureHintId): number =>
  HINT_DEFINITIONS[hintId]?.priority ?? DEFAULT_HINT_PRIORITY;

const isHintConditionSatisfied = async (
  definition: FeatureHintDefinition,
): Promise<boolean> => {
  const dependencies = definition.dependsOn;
  if (dependencies?.length) {
    for (const dependencyId of dependencies) {
      const dependencyDismissed = await isFeatureHintDismissed(dependencyId);
      if (!dependencyDismissed) return false;
    }
  }

  if (!definition.condition) return true;

  try {
    return Boolean(await definition.condition());
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to evaluate feature hint condition:", error);
    return false;
  }
};

const tryShowNextHint = async (): Promise<void> => {
  if (hasActiveHintTooltip()) return;

  const hintIds = [...pendingHints.keys()].sort(
    (a, b) => getHintPriority(a) - getHintPriority(b),
  );

  for (const hintId of hintIds) {
    const target = pendingHints.get(hintId);
    if (!target) continue;

    if (!target.isConnected) {
      pendingHints.delete(hintId);
      continue;
    }

    const definition = HINT_DEFINITIONS[hintId];
    if (!definition) {
      pendingHints.delete(hintId);
      continue;
    }

    const isDismissed = await isFeatureHintDismissed(hintId);
    if (isDismissed) {
      pendingHints.delete(hintId);
      continue;
    }

    const isConditionSatisfied = await isHintConditionSatisfied(definition);
    if (!isConditionSatisfied) continue;

    const message = definition.getMessage?.();
    if (!message && !definition.messageKey) {
      pendingHints.delete(hintId);
      continue;
    }

    pendingHints.delete(hintId);

    await showHintTooltipOnce({
      id: hintId,
      target,
      message: message ?? t(definition.messageKey!),
      iconSrc: definition.iconSrc,
      placement: definition.placement,
      onClose: () => {
        refreshFeatureHints();
      },
    });
    return;
  }
};

const runHintEvaluation = async (): Promise<void> => {
  if (isEvaluating) {
    shouldEvaluateAgain = true;
    return;
  }

  isEvaluating = true;
  do {
    shouldEvaluateAgain = false;
    await tryShowNextHint();
  } while (shouldEvaluateAgain);
  isEvaluating = false;
};

export const refreshFeatureHints = (): void => {
  void runHintEvaluation();
};

export const showFeatureHint = (
  hintId: FeatureHintId,
  target: HTMLElement,
): void => {
  if (!target.isConnected) return;
  pendingHints.set(hintId, target);
  refreshFeatureHints();
};
