import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import { findPositionModal, findMapPin } from "@/constants/selectors";
import { createTextInputButton, TextDrawUI, TextInstance } from "./ui";
import {
  getOrCreateMapPinButtonGroup,
  createMapPinGroupButton,
} from "@/components/map-pin-button";
import { Toast } from "@/components/toast";
import type { TextDrawAPI } from "@/core/di";
import { drawText, moveText, deleteText } from "./text-manipulator";
import { t } from "@/i18n/manager";

// ========================================
// Module-level state
// ========================================

let textInstances: TextInstance[] = [];
let textDrawUI: TextDrawUI;

// ========================================
// Internal functions
// ========================================

const showModal = (): void => {
  textDrawUI.show(
    async (text: string, font: string) => {
      await handleDrawText(text, font);
    },
    textInstances,
    (key: string, direction: "up" | "down" | "left" | "right") =>
      handleMoveText(key, direction),
    (key: string) => handleDeleteText(key)
  );
};

const handleDrawText = async (text: string, font: string): Promise<void> => {
  const instance = await drawText(text, font);
  if (!instance) return;

  textInstances.push(instance);
  Toast.success("Text drawn");
  textDrawUI.updateList(textInstances);
};

const handleMoveText = async (
  key: string,
  direction: "up" | "down" | "left" | "right"
): Promise<void> => {
  const instance = textInstances.find((i) => i.key === key);
  if (!instance) return;

  await moveText(instance, direction);
  textDrawUI.updateList(textInstances);
};

const handleDeleteText = async (key: string): Promise<void> => {
  textInstances = deleteText(key, textInstances);
  Toast.success("Text deleted");
  textDrawUI.updateList(textInstances);
};

/**
 * マップピン周辺にボタンを作成
 */
const createMapPinButtons = (container: Element): void => {
  const group = getOrCreateMapPinButtonGroup(container);
  
  // 既存ボタンチェック
  if (group.querySelector("#text-draw-btn")) {
    console.log("🧑‍🎨 : Text draw button already exists");
    return;
  }
  
  const button = createMapPinGroupButton({
    icon: "✏️",
    text: t`${"text_draw"}`,
    onClick: () => showModal(),
  });
  button.id = "text-draw-btn";
  
  group.appendChild(button);
  console.log("🧑‍🎨 : Text draw button added to group");
};

// ========================================
// Initialization
// ========================================

const init = (): void => {
  textDrawUI = new TextDrawUI();

  const buttonConfigs: ElementConfig[] = [
    // 優先: マップピン周辺にボタン配置
    {
      id: "text-draw-map-pin-btn",
      getTargetElement: findMapPin,
      createElement: createMapPinButtons,
    },
    // フォールバック: position modalにボタン配置
    {
      id: "text-draw-fallback-btn",
      getTargetElement: findPositionModal,
      createElement: (container) => {
        // マップピングループが既に存在する場合はスキップ
        if (document.querySelector("#map-pin-button-group")) {
          console.log("🧑‍🎨 : Map pin button group already exists, skipping fallback");
          return;
        }
        
        const button = createTextInputButton();
        button.id = "text-draw-fallback-btn";
        button.addEventListener("click", () => showModal());
        container.prepend(button);
        console.log("🧑‍🎨 : Fallback button created in position modal");
      },
    },
  ];

  setupElementObserver(buttonConfigs);
  console.log("🧑‍🎨 : TextDraw button observer initialized");
};

// ========================================
// Public API
// ========================================

export const textDrawAPI: TextDrawAPI = {
  initTextDraw: init,
};
