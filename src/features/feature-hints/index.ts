import { IMG_MR_FACE } from "@/assets/iconImages";
import {
  hasActiveHintTooltip,
  showHintTooltipOnce,
  type HintPlacement,
} from "@/components/hint-tooltip";
import { hasOpenModal } from "@/components/modal";
import { findPositionModal } from "@/constants/selectors";
import { t } from "@/i18n/manager";
import {
  getFeatureHintCooldownMs,
  isFeatureHintDismissed,
} from "@/states/feature-hints";
import { getAllGalleryMetadata } from "@/core/bridge/gallery-storage-bridge";
import { isBlueMarbleDetected } from "@/utils/blue-marble";

export type FeatureHintId =
  | "paint-pixel-icon"
  | "gallery-btn"
  | "drawing-btn"
  | "bookmark-btn"
  | "bookmarks-btn"
  | "timetravel-btn"
  // | "timetravel-fab-btn"
  | "text-draw-btn"
  | "unplaced-item"
  | "show-unplaced-only"
  | "color-isolate"
  | "data-saver"
  | "blue-marble-color-palette"
  | "overlay-mode-independent"
  | "overlay-mode-blue-marble"
  | "user-status-container"
  | "map-filter-trigger"
  | "edit-card"
  | "image-detail-draw-on-map"
  // | "image-detail-dpad"
  | "image-detail-download"
  // | "image-detail-edit-title"
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
const DEFAULT_HINT_ICON_SRC = IMG_MR_FACE;

const isNoModalOpen = () => !hasOpenModal() && !findPositionModal();

// PositionModal の出現・消滅を監視して hint を再評価する（一度だけセットアップ）
let positionModalObserverSetup = false;
const setupPositionModalObserver = () => {
  if (positionModalObserverSetup) return;
  positionModalObserverSetup = true;

  const observer = new MutationObserver(() => {
    if (pendingHints.size > 0) refreshFeatureHints();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
  // ------- Blue Marble Hints -------
  "blue-marble-color-palette": {
    messageKey: "hint_blue_marble_color_palette",
    placement: "right",
    condition: isBlueMarbleDetected,
  },
  "overlay-mode-blue-marble": {
    messageKey: "hint_overlay_mode_blue_marble",
    placement: "top",
    condition: isBlueMarbleDetected,
  },
  // ------- Main Screen Hint -------
  "gallery-btn": {
    messageKey: "hint_gallery_btn",
    placement: "right",
    priority: 1,
  },
  "gallery-import-export-btn": {
    messageKey: "hint_gallery_backup",
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
    placement: "bottom",
    condition: isNoModalOpen,
    priority: 2,
  },
  "map-filter-trigger": {
    messageKey: "hint_map_filter_trigger",
    placement: "right",
    dependsOn: ["user-status-container"],
    condition: isNoModalOpen,
  },
  // ------- Drawing Hints -------
  "drawing-btn": {
    messageKey: "hint_drawing_btn",
    placement: "top",
    dependsOn: ["gallery-btn"],
  },

  "unplaced-item": {
    messageKey: "hint_unplaced_grid",
    placement: "top",
    dependsOn: ["drawing-btn"],
  },
  // ------- Paint Modal Hints -------
  "paint-pixel-icon": {
    messageKey: "hint_palette_toggle",
    placement: "top",
    priority: 1,
  },
  "color-isolate": {
    messageKey: "hint_color_isolate",
    placement: "top",
    priority: 2,
  },
  "show-unplaced-only": {
    messageKey: "hint_show_unplaced_only",
    placement: "top",
    priority: 3,
  },

  // ------- Map Popup Hints -------
  "bookmark-btn": {
    messageKey: "hint_bookmark_btn",
    placement: "top",
    dependsOn: ["show-unplaced-only"],
    condition: isNoModalOpen,
  },
  "timetravel-btn": {
    messageKey: "hint_timetravel_btn",
    placement: "top",
    dependsOn: ["bookmark-btn"],
    condition: isNoModalOpen,
  },
  "text-draw-btn": {
    messageKey: "hint_text_draw_btn",
    placement: "top",
    dependsOn: ["timetravel-btn"],
    condition: isNoModalOpen,
  },
  // ------- Main Map Hint -------
  "bookmarks-btn": {
    messageKey: "hint_bookmarks_btn",
    placement: "left",
    dependsOn: ["bookmark-btn"],
    condition: isNoModalOpen,
  },
  // "timetravel-fab-btn": {
  //   messageKey: "hint_timetravel_fab_btn",
  //   placement: "left",
  //   dependsOn: ["timetravel-btn"],
  //   condition: () => !hasOpenModal(),
  // },
  // ------- Main Screen Hint -------
  "data-saver": {
    messageKey: "hint_data_saver",
    placement: "left",
    dependsOn: ["timetravel-btn"],
    condition: isNoModalOpen,
  },
  "overlay-mode-independent": {
    messageKey: "hint_overlay_mode_performance",
    placement: "top",
    dependsOn: ["show-unplaced-only"],
  },

  // ------- Edit Card Hint -------
  "edit-card": {
    messageKey: "hint_edit_card",
    placement: "top",
  },
  // ------- Image Detail Hints -------
  "image-detail-draw-on-map": {
    messageKey: "hint_image_detail_draw_on_map",
    placement: "right",
  },
  "image-detail-download": {
    messageKey: "hint_image_detail_download",
    placement: "top",
    dependsOn: ["image-detail-draw-on-map"],
  },
  // "image-detail-dpad": {
  //   messageKey: "hint_image_detail_dpad",
  //   placement: "top",
  //   dependsOn: ["image-detail-draw-on-map"],
  // },
  // "image-detail-edit-title": {
  //   messageKey: "hint_image_detail_edit_title",
  //   placement: "bottom",
  //   dependsOn: ["image-detail-draw-on-map"],
  // },
};

const pendingHints = new Map<FeatureHintId, HTMLElement>();
let isEvaluating = false;
let shouldEvaluateAgain = false;
let nextHintAvailableAt = 0;
let cooldownTimerId: number | null = null;

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

const scheduleHintCooldown = (delayMs: number): void => {
  if (cooldownTimerId !== null) return;
  cooldownTimerId = window.setTimeout(() => {
    cooldownTimerId = null;
    refreshFeatureHints();
  }, delayMs);
};

const tryShowNextHint = async (): Promise<void> => {
  if (hasActiveHintTooltip()) return;

  const cooldownRemainingMs = nextHintAvailableAt - Date.now();
  if (cooldownRemainingMs > 0) {
    scheduleHintCooldown(cooldownRemainingMs);
    return;
  }

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
      iconSrc: definition.iconSrc ?? DEFAULT_HINT_ICON_SRC,
      placement: definition.placement,
      onClose: async () => {
        nextHintAvailableAt = Date.now() + (await getFeatureHintCooldownMs());
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
  setupPositionModalObserver();
  pendingHints.set(hintId, target);
  refreshFeatureHints();
};
