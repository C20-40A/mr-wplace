import { createResponsiveButton } from "../../components/responsive-button";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "@/components/modal";
import { isMobileViewport } from "@/constants/breakpoints";
import { colorpalette } from "@/constants/colors";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { gotoPosition } from "@/utils/position";

export interface TextInstance {
  key: string;
  text: string;
  font: string;
  lineSpacing?: number;
  coords: { TLX: number; TLY: number; PxX: number; PxY: number };
  colorId?: number;
}

const FONT_STORAGE_KEY = "text_draw_selected_font";
const COLOR_STORAGE_KEY = "text_draw_selected_color";
const LINE_SPACING_STORAGE_KEY = "text_draw_line_spacing";

export const createTextInputButton = (): HTMLButtonElement => {
  return createResponsiveButton({
    iconText: "✏️",
    text: t`${"text_draw"}`,
    dataAttribute: "text-draw",
    altText: t`${"text_draw"}`,
  });
};

export class TextDrawUI {
  private modalElements: ModalElements | null = null;
  private textInstances: TextInstance[] = [];
  private onDraw?: (
    text: string,
    font: string,
    colorId: number,
    lineSpacing: number,
  ) => Promise<void>;
  private onMove?: (
    key: string,
    direction: "up" | "down" | "left" | "right",
  ) => void;
  private onDelete?: (key: string) => void;

  private leftPanel!: HTMLElement;
  private input!: HTMLTextAreaElement;
  private fontSelect!: HTMLSelectElement;
  private colorSelect!: HTMLSelectElement;
  private lineSpacingInput!: HTMLInputElement;

  constructor() {}

  private isTextHiddenByColorFilter(colorId?: number): boolean {
    const manager = window.mrWplace?.colorFilterManager;
    if (!manager?.isFilterActive()) return false;

    const targetColorId = colorId ?? 1;
    return !manager.getSelectedColors().includes(targetColorId);
  }

  private createCoordsLabel(instance: TextInstance): HTMLButtonElement {
    const coordsButton = document.createElement("button");
    coordsButton.textContent =
      `${instance.coords.TLX}-${instance.coords.TLY}-` +
      `${instance.coords.PxX}-${instance.coords.PxY}`;
    coordsButton.title = "Go to this text position";
    coordsButton.style.cssText = `
      background: none;
      border: none;
      padding: 0;
      margin-top: 0.125rem;
      color: #2563eb;
      cursor: pointer;
      font-size: 0.625rem;
      opacity: 0.8;
      text-align: left;
      text-decoration: underline;
      text-underline-offset: 2px;
    `;
    coordsButton.onclick = async () => {
      const { lat, lng } = tilePixelToLatLng(
        instance.coords.TLX,
        instance.coords.TLY,
        instance.coords.PxX,
        instance.coords.PxY,
      );

      await gotoPosition({ lat, lng, zoom: 14 });
    };
    return coordsButton;
  }

  private buildUI(): void {
    if (!this.modalElements) return;
    const container = this.modalElements.container;
    const isMobile = isMobileViewport();

    const contentContainer = document.createElement("div");
    contentContainer.style.cssText = `
      display: flex;
      flex-direction: ${isMobile ? "column" : "row"};
      gap: 0.75rem;
      min-height: 0;
    `;

    // Left: Text list
    this.leftPanel = document.createElement("div");
    this.leftPanel.style.cssText = `
      flex: 1 1 0%;
      min-height: 0;
      max-height: ${isMobile ? "50vh" : "400px"};
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      padding: 0.5rem;
      touch-action: pan-y;
    `;

    // Right: Input form
    const rightPanel = document.createElement("div");
    rightPanel.style.cssText = `
      flex: 0 0 ${isMobile ? "auto" : "min(18rem, 45%)"};
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    `;

    this.input = document.createElement("textarea");
    this.input.placeholder = "Enter text...";
    this.input.className = "textarea textarea-bordered w-full";
    this.input.rows = 4;
    this.input.style.cssText = "width: 100%; resize: vertical; white-space: pre-wrap;";

    this.fontSelect = document.createElement("select");
    this.fontSelect.className = "select select-bordered w-full";
    this.fontSelect.style.cssText = "width: 100%; font-family: inherit;";
    this.fontSelect.innerHTML = `
      <option value="c20_pixel">C20 Pixel (3x3～)(A,a,ひ,カ,記)</option>
      <option value="Bytesized" style="font-family: Bytesized;">Bytesized (3x4)(A,a)</option>
      <option value="comic_sans_ms_pixel" style="font-family: comic_sans_ms_pixel;">Comic Sans MS Pixel (6x10)(MultiLang)</option>
      <option value="Misaki" style="font-family: Misaki;">🇯🇵 Misaki (8x8)(A,ひ,カ,漢)</option>
      <option value="k8x12" style="font-family: k8x12;">🇯🇵 k8x12 (8x12)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Dougenzaka_12" style="font-family: KH_Dot_Dougenzaka_12;">🇯🇵 KH Dot Dougenzaka (12px)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Kagurazaka_12" style="font-family: KH_Dot_Kagurazaka_12;">🇯🇵 KH Dot Kagurazaka (12px)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Kodenmachou_12" style="font-family: KH_Dot_Kodenmachou_12;">🇯🇵 KH Dot Kodenmachou (12px)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Akihabara_16" style="font-family: KH_Dot_Akihabara_16;">🇯🇵 KH Dot Akihabara (16px)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Hatchoubori_16" style="font-family: KH_Dot_Hatchoubori_16;">🇯🇵 KH Dot Hatchoubori (16px)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Kabutochou_16" style="font-family: KH_Dot_Kabutochou_16;">🇯🇵 KH Dot Kabutochou (16px)(A,ひ,カ,漢)</option>
      <option value="KH_Dot_Ningyouchou_16" style="font-family: KH_Dot_Ningyouchou_16;">🇯🇵 KH Dot Ningyouchou (16px)(A,ひ,カ,漢)</option>
    `;

    // Restore saved font selection
    const savedFont = localStorage.getItem(FONT_STORAGE_KEY);
    if (savedFont) this.fontSelect.value = savedFont;

    // Update select font-family on change
    const updateSelectFont = () => {
      this.fontSelect.style.fontFamily = this.fontSelect.value;
      localStorage.setItem(FONT_STORAGE_KEY, this.fontSelect.value);
    };
    this.fontSelect.addEventListener("change", updateSelectFont);
    updateSelectFont();

    // Color selector
    this.colorSelect = document.createElement("select");
    this.colorSelect.className = "select select-bordered w-full";
    this.colorSelect.style.cssText = "width: 100%;";

    // Build color options from colorpalette
    this.colorSelect.innerHTML = colorpalette
      .map((color) => {
        const [r, g, b] = color.rgb;
        const colorStyle = `background: rgb(${r}, ${g}, ${b}); color: ${r + g + b > 384 ? "#000" : "#fff"};`;
        const premiumBadge = color.premium ? " 💧" : "";
        return `<option value="${color.id}" style="${colorStyle}">${color.name}${premiumBadge}</option>`;
      })
      .join("");

    // Restore saved color selection (default to Black if not set)
    const savedColor = localStorage.getItem(COLOR_STORAGE_KEY);
    if (savedColor) {
      this.colorSelect.value = savedColor;
    } else {
      this.colorSelect.value = "1"; // Black
    }

    // Save color selection on change
    this.colorSelect.addEventListener("change", () => {
      localStorage.setItem(COLOR_STORAGE_KEY, this.colorSelect.value);
    });

    this.lineSpacingInput = document.createElement("input");
    this.lineSpacingInput.type = "number";
    this.lineSpacingInput.min = "0";
    this.lineSpacingInput.step = "1";
    this.lineSpacingInput.className = "input input-bordered w-full";
    this.lineSpacingInput.placeholder = "Line spacing";
    this.lineSpacingInput.style.cssText = "width: 100%;";
    this.lineSpacingInput.value =
      localStorage.getItem(LINE_SPACING_STORAGE_KEY) ?? "0";
    this.lineSpacingInput.addEventListener("change", () => {
      const value = Math.max(
        0,
        Number.parseInt(this.lineSpacingInput.value || "0", 10) || 0,
      );
      this.lineSpacingInput.value = String(value);
      localStorage.setItem(LINE_SPACING_STORAGE_KEY, String(value));
    });

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText =
      "display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: auto;";

    const drawButton = document.createElement("button");
    drawButton.innerHTML = "✏️ Draw";
    drawButton.className = "btn btn-primary";

    drawButton.onclick = async () => {
      const text = this.input.value;
      if (!text || !this.onDraw) return;
      const colorId = parseInt(this.colorSelect.value, 10);
      const lineSpacing = Math.max(
        0,
        Number.parseInt(this.lineSpacingInput.value || "0", 10) || 0,
      );
      this.lineSpacingInput.value = String(lineSpacing);
      localStorage.setItem(LINE_SPACING_STORAGE_KEY, String(lineSpacing));
      await this.onDraw(text, this.fontSelect.value, colorId, lineSpacing);
      this.input.value = "";
    };

    this.input.onkeydown = (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        drawButton.click();
      }
    };

    buttonContainer.appendChild(drawButton);

    rightPanel.appendChild(this.input);
    rightPanel.appendChild(this.fontSelect);
    rightPanel.appendChild(this.colorSelect);
    rightPanel.appendChild(this.lineSpacingInput);
    rightPanel.appendChild(buttonContainer);

    contentContainer.appendChild(rightPanel);
    contentContainer.appendChild(this.leftPanel);

    container.appendChild(contentContainer);
  }

  show(
    onDraw: (
      text: string,
      font: string,
      colorId: number,
      lineSpacing: number,
    ) => Promise<void>,
    textInstances: TextInstance[],
    onMove: (key: string, direction: "up" | "down" | "left" | "right") => void,
    onDelete: (key: string) => void,
  ): void {
    this.onDraw = onDraw;
    this.textInstances = textInstances;
    this.onMove = onMove;
    this.onDelete = onDelete;

    this.showModal(); // モーダルを先に作成（buildUIが呼ばれる）
    this.updateList(); // その後リスト更新
    this.input.focus();
  }

  private showModal(): void {
    this.modalElements = createModal({
      id: "wplace-studio-text-draw-modal",
      title: t`${"text_draw"}`,
      maxWidth: "600px",
    });

    this.buildUI();
    this.modalElements.modal.showModal();
  }

  updateList(textInstances?: TextInstance[]): void {
    if (textInstances) {
      this.textInstances = textInstances;
    }

    this.leftPanel.innerHTML = "";

    if (this.textInstances.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = "No text instances";
      emptyMsg.style.cssText =
        "text-align: center; color: #9ca3af; padding: 2rem;";
      this.leftPanel.appendChild(emptyMsg);
      return;
    }

    this.textInstances.forEach((instance) => {
      const itemContainer = document.createElement("div");
      itemContainer.style.cssText =
        "border-bottom: 1px solid #e5e7eb; padding: 0.25rem 0; position: relative; display: flex; align-items: center; gap: 0.5rem;";

      // Delete button (×) - absolute position at top right
      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "×";
      deleteBtn.style.cssText =
        "position: absolute; top: 0; right: 0; background: none; border: none; font-size: 1.125rem; line-height: 1; opacity: 0.4; cursor: pointer; padding: 0.125rem 0.25rem;";
      deleteBtn.onmouseover = () => {
        deleteBtn.style.opacity = "1";
      };
      deleteBtn.onmouseout = () => {
        deleteBtn.style.opacity = "0.4";
      };
      deleteBtn.onclick = () => {
        this.onDelete?.(instance.key);
      };

      // Text container - takes up remaining space
      const textContainer = document.createElement("div");
      textContainer.style.cssText =
        "flex: 1; min-width: 0; padding-right: 1.5rem;";

      const textLabel = document.createElement("div");
      textLabel.textContent = instance.text;
      textLabel.style.cssText =
        "font-weight: 500; word-break: break-word; white-space: pre-wrap; font-size: 0.875rem;";

      const fontLabel = document.createElement("div");
      fontLabel.textContent =
        instance.lineSpacing && instance.lineSpacing > 0
          ? `${instance.font} / line ${instance.lineSpacing}`
          : instance.font;
      fontLabel.style.cssText =
        "font-size: 0.625rem; margin-top: 0.125rem; opacity: 0.6;";

      // Color indicator
      const colorInfo = document.createElement("div");
      colorInfo.style.cssText =
        "display: flex; align-items: center; gap: 0.25rem; margin-top: 0.125rem;";

      const colorDot = document.createElement("div");
      colorDot.style.cssText =
        "width: 0.75rem; height: 0.75rem; border-radius: 50%; border: 1px solid #e5e7eb;";

      const colorId = instance.colorId ?? 1;
      const color = colorpalette.find((c) => c.id === colorId);
      if (color) {
        const [r, g, b] = color.rgb;
        colorDot.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }

      const colorName = document.createElement("span");
      colorName.textContent = color?.name ?? "Black";
      colorName.style.cssText = "font-size: 0.625rem; opacity: 0.6;";

      colorInfo.appendChild(colorDot);
      colorInfo.appendChild(colorName);

      const coordsLabel = this.createCoordsLabel(instance);

      textContainer.appendChild(textLabel);
      textContainer.appendChild(fontLabel);
      textContainer.appendChild(colorInfo);
      textContainer.appendChild(coordsLabel);

      if (this.isTextHiddenByColorFilter(instance.colorId)) {
        const warning = document.createElement("div");
        warning.textContent = "Hidden by current color filter";
        warning.style.cssText =
          "font-size: 0.625rem; color: #b45309; margin-top: 0.25rem;";
        textContainer.appendChild(warning);
      }

      // D-pad controls - compact
      const dPadContainer = document.createElement("div");
      dPadContainer.style.cssText =
        "display: grid; grid-template-columns: repeat(3, 1.5rem); grid-template-rows: repeat(3, 1.5rem); gap: 1px; flex-shrink: 0;";

      const createMoveButton = (
        direction: "up" | "down" | "left" | "right",
        symbol: string,
        gridColumn: string,
        gridRow: string,
      ) => {
        const btn = document.createElement("button");
        btn.textContent = symbol;
        btn.style.cssText = `
          border: 1px solid #e5e7eb;
          border-radius: 0.125rem;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          grid-column: ${gridColumn};
          grid-row: ${gridRow};
        `;
        btn.onmouseover = () => {
          btn.style.outline = "2px solid #3b82f6";
        };
        btn.onmouseout = () => {
          btn.style.outline = "none";
        };
        btn.onclick = () => {
          this.onMove?.(instance.key, direction);
        };
        return btn;
      };

      // D-pad layout:
      //     [↑]
      // [←]     [→]
      //     [↓]
      dPadContainer.appendChild(createMoveButton("up", "↑", "2", "1"));
      dPadContainer.appendChild(createMoveButton("left", "←", "1", "2"));
      dPadContainer.appendChild(createMoveButton("right", "→", "3", "2"));
      dPadContainer.appendChild(createMoveButton("down", "↓", "2", "3"));

      itemContainer.appendChild(deleteBtn);
      itemContainer.appendChild(textContainer);
      itemContainer.appendChild(dPadContainer);
      this.leftPanel.appendChild(itemContainer);
    });
  }
}
