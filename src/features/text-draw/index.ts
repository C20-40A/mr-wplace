import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import { findPositionModal } from "../../constants/selectors";
import { createTextInputButton, createTextModal } from "./ui";
import { getCurrentPosition } from "../../utils/position";
import { ImageItem } from "../gallery/routes/list/components";
import { Toast } from "../../components/toast";

export class TextDraw {
  private fontLoaded = false;
  private readonly fonts = {
    Bytesized: {
      path: "assets/fonts/Bytesized/Bytesized-Regular.ttf",
      size: 8,
    },
    minikana: { path: "assets/fonts/4x4minkana/4x4kanafont.ttf", size: 5 },
    Misaki: { path: "assets/fonts/misaki/misaki_gothic.ttf", size: 8 },
    k8x12: { path: "assets/fonts/k8x12/k8x12S.ttf", size: 12 },
    comic_sans_ms_pixel: {
      path: "assets/fonts/comic_sans_ms_pixel/comic_sans_ms_pixel.ttf",
      size: 16,
    },
  };

  constructor() {
    this.init();
  }

  private init(): void {
    const buttonConfigs: ElementConfig[] = [
      {
        id: "text-draw-btn",
        getTargetElement: findPositionModal,
        createElement: (container) => {
          const button = createTextInputButton();
          button.id = "text-draw-btn";
          button.addEventListener("click", () => this.showModal());
          container.prepend(button);
        },
      },
    ];

    setupElementObserver(buttonConfigs);
    console.log("🧑‍🎨 : TextDraw button observer initialized");
  }

  private showModal(): void {
    const modal = createTextModal();
    modal.show(
      async (text: string, font: string) => {
        await this.drawText(text, font);
      },
      () => this.clearText()
    );
  }

  private async drawText(text: string, font: string): Promise<void> {
    const position = getCurrentPosition();
    if (!position) {
      Toast.error("Position not found");
      return;
    }

    await this.ensureFontLoaded();

    const blob = await this.textToBlob(text, font);
    const dataUrl = await this.blobToDataUrl(blob);

    const imageItem: ImageItem = {
      key: `text_${Date.now()}`,
      dataUrl,
      title: text,
    };

    const tileOverlay = window.mrWplace?.tileOverlay;
    if (!tileOverlay) {
      Toast.error("TileOverlay not found");
      return;
    }

    await tileOverlay.drawImageAt(position.lat, position.lng, imageItem);
    Toast.success("Text drawn");
    console.log("🧑‍🎨 : Text drawn at position", position);
  }

  private async ensureFontLoaded(): Promise<void> {
    if (this.fontLoaded) return;

    for (const [name, config] of Object.entries(this.fonts)) {
      const fontUrl = chrome.runtime.getURL(config.path);
      const font = new FontFace(name, `url(${fontUrl})`);
      await font.load();
      document.fonts.add(font);
      console.log("🧑‍🎨 : Font loaded", name);
    }

    this.fontLoaded = true;
  }

  private async textToBlob(text: string, font: string): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not found");

    const fontSize = this.fonts[font as keyof typeof this.fonts].size;
    ctx.font = `${fontSize}px ${font}`;

    const metrics = ctx.measureText(text);
    canvas.width = Math.ceil(metrics.width);
    canvas.height = fontSize;

    ctx.font = `${fontSize}px ${font}`;
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.fillText(text, 0, 0);

    // Pre-render to bitmap: 閾値処理でアンチエイリアス排除
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha >= 128) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) throw new Error("Blob conversion failed");
        resolve(blob);
      }, "image/png");
    });
  }

  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  private clearText(): void {
    const tileDrawManager = window.mrWplace?.tileOverlay?.tileDrawManager;
    if (!tileDrawManager) {
      Toast.error("TileDrawManager not found");
      return;
    }

    tileDrawManager.removeTextDrawInstances();
    Toast.success("Text cleared");
    console.log("🧑‍🎨 : Text instances cleared");
  }
}
