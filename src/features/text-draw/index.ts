import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import { findPositionModal } from "../../constants/selectors";
import { createTextInputButton, TextDrawUI, TextInstance } from "./ui";
import { Toast } from "../../components/toast";
import type { TextDrawAPI } from "../../core/di";
import { drawText, moveText, deleteText } from "./text-manipulator";

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
  const tileDrawManager = window.mrWplace?.tileOverlay?.tileDrawManager;
  if (!tileDrawManager) {
    Toast.error("TileDrawManager not found");
    return;
  }

  const instance = await drawText(text, font, tileDrawManager);
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

  const tileDrawManager = window.mrWplace?.tileOverlay?.tileDrawManager;
  if (!tileDrawManager) return;

  await moveText(instance, direction, tileDrawManager);
  textDrawUI.updateList(textInstances);
};

const handleDeleteText = async (key: string): Promise<void> => {
  const tileDrawManager = window.mrWplace?.tileOverlay?.tileDrawManager;
  if (!tileDrawManager) return;

  textInstances = deleteText(key, tileDrawManager, textInstances);
  Toast.success("Text deleted");
  textDrawUI.updateList(textInstances);
};

// ========================================
// Initialization
// ========================================

const init = (): void => {
  textDrawUI = new TextDrawUI();

  const buttonConfigs: ElementConfig[] = [
    {
      id: "text-draw-btn",
      getTargetElement: findPositionModal,
      createElement: (container) => {
        const button = createTextInputButton();
        button.id = "text-draw-btn";
        button.addEventListener("click", () => showModal());
        container.prepend(button);
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
