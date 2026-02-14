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
  iconSrc?: string;
  placement: HintPlacement;
}

const HINT_DIALOG_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA8UlEQVR42t2WbQrDIAyGc5D+3DG8/216BkdhjkzefNnEsQmCYmuevDFRoj9u/dVLNrU6+j7PeGvtY8znc2drWzzXoPYYN8KxZhx5hJoTZM3zAeBpzGC+9MhTQQEqi39AgZzUs2KsrNdAoDGfZ1fAkPQVAMQ3/hqApoSSJTUqOOp+unHyZENFBkAABKHcinXZsFsFNf8rpSd0+g1FqLwQXfPzeFiX0X3D0jtgBsg8A2Juz4YkBVafY2ZxQSFwqOAC8Va3uwA9FG/r7pcA0D7W87xbEOgsDIAB4QToYQAJSgJA/2gAkR/dAA4nfgSgKARviCcq6ovGz9NsNQAAAABJRU5ErkJggg==";

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
  "paint-pixel-icon": {
    messageKey: "hint_palette_toggle",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
  },
  "show-unplaced-only": {
    messageKey: "hint_show_unplaced_only",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
  },
  "color-isolate": {
    messageKey: "hint_color_isolate",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
  },
  "data-saver": {
    messageKey: "hint_data_saver",
    iconSrc: HINT_DIALOG_ICON,
    placement: "left",
  },
  "overlay-mode-independent": {
    getMessage: () =>
      `${t("hint_overlay_mode_independent_prefix")}「${t("popup_overlay_mode_layer")}」${t("hint_overlay_mode_independent_suffix")}`,
    iconSrc: HINT_DIALOG_ICON,
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
    iconSrc: definition.iconSrc,
    placement: definition.placement,
  });
};

export const showFeatureHint = (
  hintId: FeatureHintId,
  target: HTMLElement,
): void => {
  void waitForDependencyAndShow(hintId, target);
};
