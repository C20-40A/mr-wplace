import { createResponsiveButton } from "../../components/responsive-button";
import { t } from "../../i18n/manager";
import { BaseModalUI, ModalConfig } from "../../components/base-modal-ui";

export interface TextInstance {
  key: string;
  text: string;
  font: string;
  coords: { TLX: number; TLY: number; PxX: number; PxY: number };
}

export const createTextInputButton = (): HTMLButtonElement => {
  return createResponsiveButton({
    iconText: "✏️",
    text: t`${"text_draw"}`,
    dataAttribute: "text-draw",
    altText: t`${"text_draw"}`,
  });
};

export class TextDrawUI extends BaseModalUI {
  private textInstances: TextInstance[] = [];
  private onDraw?: (text: string, font: string) => Promise<void>;
  private onMove?: (
    key: string,
    direction: "up" | "down" | "left" | "right"
  ) => void;
  private onDelete?: (key: string) => void;

  private leftPanel!: HTMLElement;
  private input!: HTMLInputElement;
  private fontSelect!: HTMLSelectElement;

  constructor() {
    super();
    this.buildUI();
  }

  getModalConfig(): ModalConfig {
    return {
      id: "wplace-studio-text-draw-modal",
      title: t`${"text_draw"}`,
      maxWidth: "600px",
    };
  }

  private buildUI(): void {
    const container = this.getContainer();
    if (!container) return;

    const contentContainer = document.createElement("div");
    contentContainer.style.cssText = "display: flex; gap: 1rem;";

    // Left: Text list
    this.leftPanel = document.createElement("div");
    this.leftPanel.style.cssText =
      "flex: 1; max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.5rem;";

    // Right: Input form
    const rightPanel = document.createElement("div");
    rightPanel.style.cssText =
      "flex: 1; display: flex; flex-direction: column; gap: 0.5rem;";

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.placeholder = "Enter text...";
    this.input.className = "input input-bordered w-full";
    this.input.style.cssText = "width: 100%;";

    this.fontSelect = document.createElement("select");
    this.fontSelect.className = "select select-bordered w-full";
    this.fontSelect.style.cssText = "width: 100%;";
    this.fontSelect.innerHTML = `
      <option value="Bytesized">Bytesized (3x4)(A)</option>
      <option value="comic_sans_ms_pixel">Comic Sans MS Pixel (6x10)(MultiLang)</option>
      <option value="kyokugen">🇯🇵 kyokugen(3x3～)(カ)</option>
      <option value="minikana">🇯🇵 Minikana (4x4)(カ)</option>
      <option value="Misaki">🇯🇵 Misaki (8x8)(A,ひ,カ,漢)</option>
      <option value="k8x12">🇯🇵 k8x12 (8x12)(A,ひ,カ,漢)</option>
    `;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText =
      "display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: auto;";

    const drawButton = document.createElement("button");
    drawButton.innerHTML = "✏️ Draw";
    drawButton.className = "btn btn-primary";

    drawButton.onclick = async () => {
      const text = this.input.value.trim();
      if (!text || !this.onDraw) return;
      await this.onDraw(text, this.fontSelect.value);
      this.input.value = "";
    };

    this.input.onkeydown = (e) => {
      if (e.key === "Enter") {
        drawButton.click();
      }
    };

    buttonContainer.appendChild(drawButton);

    rightPanel.appendChild(this.input);
    rightPanel.appendChild(this.fontSelect);
    rightPanel.appendChild(buttonContainer);

    contentContainer.appendChild(this.leftPanel);
    contentContainer.appendChild(rightPanel);

    container.appendChild(contentContainer);
  }

  show(
    onDraw: (text: string, font: string) => Promise<void>,
    textInstances: TextInstance[],
    onMove: (key: string, direction: "up" | "down" | "left" | "right") => void,
    onDelete: (key: string) => void
  ): void {
    this.onDraw = onDraw;
    this.textInstances = textInstances;
    this.onMove = onMove;
    this.onDelete = onDelete;

    this.updateList();
    this.showModal();
    this.input.focus();
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
        "border-bottom: 1px solid #e5e7eb; padding: 0.5rem 0;";

      const textContainer = document.createElement("div");
      textContainer.style.cssText = "margin-bottom: 0.25rem;";

      const textLabel = document.createElement("div");
      textLabel.textContent = instance.text;
      textLabel.style.cssText = "font-weight: 500; word-break: break-all;";

      const fontLabel = document.createElement("div");
      fontLabel.textContent = instance.font;
      fontLabel.style.cssText = "font-size: 0.75rem; color: #6b7280;";

      textContainer.appendChild(textLabel);
      textContainer.appendChild(fontLabel);

      const controlsContainer = document.createElement("div");
      controlsContainer.style.cssText =
        "display: flex; gap: 0.25rem; align-items: center;";

      const createMoveButton = (
        direction: "up" | "down" | "left" | "right",
        symbol: string
      ) => {
        const btn = document.createElement("button");
        btn.textContent = symbol;
        btn.className = "btn btn-sm";
        btn.style.cssText =
          "min-height: 2rem; height: 2rem; padding: 0 0.5rem;";
        btn.onclick = () => {
          this.onMove?.(instance.key, direction);
        };
        return btn;
      };

      controlsContainer.appendChild(createMoveButton("up", "↑"));
      controlsContainer.appendChild(createMoveButton("down", "↓"));
      controlsContainer.appendChild(createMoveButton("left", "←"));
      controlsContainer.appendChild(createMoveButton("right", "→"));

      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "🗑️";
      deleteBtn.className = "btn btn-sm";
      deleteBtn.style.cssText =
        "min-height: 2rem; height: 2rem; padding: 0 0.5rem; margin-left: auto;";
      deleteBtn.onclick = () => {
        this.onDelete?.(instance.key);
      };
      controlsContainer.appendChild(deleteBtn);

      itemContainer.appendChild(textContainer);
      itemContainer.appendChild(controlsContainer);
      this.leftPanel.appendChild(itemContainer);
    });
  }
}
