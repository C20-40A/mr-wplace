import { IMG_MR_FACE } from "@/assets/iconImages";
import {
  hasActiveHintTooltip,
  showHintTooltipOnce,
  type HintPlacement,
} from "@/components/hint-tooltip";
import { hasOpenModal } from "@/components/modal";
import { t } from "@/i18n/manager";
import { isFeatureHintDismissed } from "@/states/feature-hints";
import { getAllGalleryMetadata } from "@/core/bridge/gallery-storage-bridge";

export type FeatureHintId =
  | "paint-pixel-icon"
  | "gallery-btn"
  | "drawing-btn"
  | "bookmark-btn"
  | "bookmarks-btn"
  | "timetravel-btn"
  | "timetravel-fab-btn"
  | "text-draw-btn"
  | "save-current-snapshot-btn"
  | "unplaced-item"
  | "show-unplaced-only"
  | "color-isolate"
  | "data-saver"
  | "overlay-mode-independent"
  | "user-status-container"
  | "map-filter-trigger"
  | "edit-card"
  | "image-detail-draw-on-map"
  | "image-detail-dpad"
  | "image-detail-download"
  | "image-detail-edit-title"
  | "gallery-import-export-btn";

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

const HINT_DIALOG_ICON = IMG_MR_FACE;

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
  // ------- Main Screen Hint -------
  "gallery-btn": {
    messageKey: "hint_gallery_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "right",
    priority: 1,
  },
  "gallery-import-export-btn": {
    messageKey: "hint_gallery_backup",
    iconSrc: HINT_DIALOG_ICON,
    placement: "right",
    priority: 2,
    dependsOn: ["gallery-btn"],
    condition: async () => {
      try {
        const items = await getAllGalleryMetadata();
        return items.length >= 3;
      } catch (e) {
        return false;
      }
    },
  },
  "user-status-container": {
    messageKey: "hint_user_status_container",
    iconSrc: HINT_DIALOG_ICON,
    placement: "bottom",
    condition: () => !hasOpenModal(),
    priority: 2,
  },
  "map-filter-trigger": {
    messageKey: "hint_map_filter_trigger",
    iconSrc: HINT_DIALOG_ICON,
    placement: "right",
    dependsOn: ["user-status-container"],
    condition: () => !hasOpenModal(),
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
  },
  "color-isolate": {
    messageKey: "hint_color_isolate",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    priority: 2,
  },
  "show-unplaced-only": {
    messageKey: "hint_show_unplaced_only",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    priority: 3,
  },

  // ------- Map Popup Hints -------
  "bookmark-btn": {
    messageKey: "hint_bookmark_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["show-unplaced-only"],
    condition: () => !hasOpenModal(),
  },
  "timetravel-btn": {
    messageKey: "hint_timetravel_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["bookmark-btn"],
    condition: () => !hasOpenModal(),
  },
  "text-draw-btn": {
    messageKey: "hint_text_draw_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["timetravel-btn"],
    condition: () => !hasOpenModal(),
  },
  // ------- Main Map Hint -------
  "bookmarks-btn": {
    messageKey: "hint_bookmarks_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "left",
    dependsOn: ["bookmark-btn"],
    condition: () => !hasOpenModal(),
  },
  "timetravel-fab-btn": {
    messageKey: "hint_timetravel_fab_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "left",
    dependsOn: ["timetravel-btn"],
    condition: () => !hasOpenModal(),
  },
  "save-current-snapshot-btn": {
    messageKey: "hint_save_current_snapshot_btn",
    iconSrc: HINT_DIALOG_ICON,
    placement: "left",
  },
  // ------- Main Screen Hint -------
  "data-saver": {
    messageKey: "hint_data_saver",
    iconSrc: HINT_DIALOG_ICON,
    placement: "left",
    dependsOn: ["save-current-snapshot-btn"],
    condition: () => !hasOpenModal(),
  },
  "overlay-mode-independent": {
    getMessage: () =>
      `${t("hint_overlay_mode_independent_prefix")}「${t("popup_overlay_mode_layer")}」${t("hint_overlay_mode_independent_suffix")}`,
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["show-unplaced-only"],
  },
  // ------- Edit Card Hint -------
  "edit-card": {
    messageKey: "hint_edit_card",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
  },
  // ------- Image Detail Hints -------
  "image-detail-draw-on-map": {
    messageKey: "hint_image_detail_draw_on_map",
    iconSrc: HINT_DIALOG_ICON,
    placement: "right",
  },
  "image-detail-dpad": {
    messageKey: "hint_image_detail_dpad",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["image-detail-draw-on-map"],
  },
  "image-detail-download": {
    messageKey: "hint_image_detail_download",
    iconSrc: HINT_DIALOG_ICON,
    placement: "top",
    dependsOn: ["image-detail-dpad"],
  },
  "image-detail-edit-title": {
    messageKey: "hint_image_detail_edit_title",
    iconSrc: HINT_DIALOG_ICON,
    placement: "bottom",
    dependsOn: ["image-detail-draw-on-map"],
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
