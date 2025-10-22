import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import { findPositionModal, findMapPin } from "@/constants/selectors";
import { createTextInputButton, TextDrawUI, TextInstance } from "./ui";
import {
  createMapPinButton,
  createMapPinButtonContainer,
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
  // 既存ボタンコンテナの存在チェック
  const existingContainer = container.querySelector("#text-draw-map-pin-btn");
  if (existingContainer) {
    console.log("🧑‍🎨 : Map pin button already exists in this marker, skipping");
    return;
  }

  // 他のマーカーに付いている古いボタンを削除
  const oldButtons = document.querySelectorAll("#text-draw-map-pin-btn");
  oldButtons.forEach((oldButton) => {
    if (!container.contains(oldButton)) {
      console.log("🧑‍🎨 : Removing old map pin button from different marker");
      oldButton.remove();
    }
  });

  const buttonContainer = createMapPinButtonContainer();
  buttonContainer.id = "text-draw-map-pin-btn"; // IDを設定
  
  const textDrawButton = createMapPinButton({
    icon: "✏️",
    text: t`${"text_draw"}`,
    onClick: () => showModal(),
    position: "right",
  });
  
  buttonContainer.appendChild(textDrawButton);
  container.appendChild(buttonContainer);
  
  console.log("🧑‍🎨 : Map pin button created");
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
        // マップピンボタンが既に存在する場合はスキップ
        if (document.querySelector("#text-draw-map-pin-btn")) {
          console.log("🧑‍🎨 : Map pin button already exists, skipping fallback");
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
