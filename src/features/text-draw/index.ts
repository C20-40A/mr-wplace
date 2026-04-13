import {
  setupElementObserver,
  type ElementConfig,
} from "@/components/element-observer";
import { TextDrawUI, TextInstance } from "./ui";
import { createMapPinButtonObserverConfig } from "@/utils/map-pin-helper";
import type { TextDrawAPI } from "@/core/di";
import { drawText, moveText, deleteText, updateText } from "./text-manipulator";
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
    async (
      text: string,
      font: string,
      colorId: number,
      lineSpacing: number,
      editingKey?: string,
    ) => {
      await handleSubmitText(text, font, colorId, lineSpacing, editingKey);
    },
    textInstances,
    (key: string, direction: "up" | "down" | "left" | "right") =>
      handleMoveText(key, direction),
    (key: string) => handleDeleteText(key),
  );
};

const handleSubmitText = async (
  text: string,
  font: string,
  colorId: number,
  lineSpacing: number,
  editingKey?: string,
): Promise<void> => {
  if (editingKey) {
    const updated = await updateText(
      editingKey,
      text,
      font,
      colorId,
      lineSpacing,
    );
    if (!updated) return;

    textInstances = textInstances.map((instance) =>
      instance.key === editingKey ? updated : instance,
    );
    textDrawUI.updateList(textInstances);
    return;
  }

  const instance = await drawText(text, font, colorId, lineSpacing);
  if (!instance) return;

  textInstances.push(instance);
  textDrawUI.updateList(textInstances);
};

const handleMoveText = async (
  key: string,
  direction: "up" | "down" | "left" | "right",
): Promise<void> => {
  const instance = textInstances.find((i) => i.key === key);
  if (!instance) return;

  await moveText(instance, direction);
  textDrawUI.updateList(textInstances);
};

const handleDeleteText = async (key: string): Promise<void> => {
  textInstances = await deleteText(key, textInstances);
  textDrawUI.updateList(textInstances);
};

// ========================================
// Initialization
// ========================================

const init = async (): Promise<void> => {
  const { TextLayerStorage } = await import("./text-layer-storage");
  const { sendTextLayersToInject } = await import("@/content");

  textDrawUI = new TextDrawUI();

  // Load existing text layers from storage
  const textLayerStorage = new TextLayerStorage();
  const textLayers = await textLayerStorage.getAll();
  textInstances = textLayers.map((layer) => ({
    key: layer.key,
    text: layer.text,
    font: layer.font,
    lineSpacing: layer.lineSpacing ?? 0,
    coords: layer.coords,
    colorId: layer.colorId,
  }));

  // Send text layers to inject side
  await sendTextLayersToInject();

  const buttonConfigs: ElementConfig[] = [
    // 優先: マップピン周辺にボタン配置
    createMapPinButtonObserverConfig({
      observerId: "text-draw-map-pin-btn",
      id: "text-draw-btn",
      icon: "✏️",
      text: t`${"text_draw"}`,
      onClick: showModal,
      hintId: "text-draw-btn",
    }),
    // フォールバック: position modalにボタン配置
    // {
    //   id: "text-draw-fallback-btn",
    //   getTargetElement: findPositionModal,
    //   createElement: (container) => {
    //     // マップピングループが既に存在する場合はスキップ
    //     if (document.querySelector("#map-pin-button-group")) return;

    //     const button = createTextInputButton();
    //     button.id = "text-draw-fallback-btn";
    //     button.addEventListener("click", () => showModal());
    //     container.prepend(button);
    //     console.log("🧑‍🎨 : Fallback button created in position modal");
    //   },
    // },
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
