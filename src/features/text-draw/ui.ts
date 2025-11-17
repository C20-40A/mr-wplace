import { createResponsiveButton } from "../../components/responsive-button";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "@/components/modal";

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

export class TextDrawUI {
  private modalElements: ModalElements | null = null;
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

  constructor() {}

  private buildUI(): void {
    if (!this.modalElements) return;
    const container = this.modalElements.container;

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
      <option value="c20_pixel">C20 Pixel (3x3～)(A,a,ひ,カ,記)</option>
      <option value="Bytesized">Bytesized (3x4)(A,a)</option>
      <option value="comic_sans_ms_pixel">Comic Sans MS Pixel (6x10)(MultiLang)</option>
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

    this.showModal(); // モーダルを先に作成（buildUIが呼ばれる）
    this.updateList(); // その後リスト更新
    this.input.focus();
  }

  private showModal(): void {
    // モーダルが既に存在している場合は削除（毎回作り直す）
    if (this.modalElements?.modal.parentElement) {
      this.modalElements.modal.remove();
      this.modalElements = null;
    }

    // 新しいモーダルを作成
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
        "font-weight: 500; word-break: break-all; font-size: 0.875rem;";

      const fontLabel = document.createElement("div");
      fontLabel.textContent = instance.font;
      fontLabel.style.cssText =
        "font-size: 0.625rem; margin-top: 0.125rem; opacity: 0.6;";

      textContainer.appendChild(textLabel);
      textContainer.appendChild(fontLabel);

      // D-pad controls - compact
      const dPadContainer = document.createElement("div");
      dPadContainer.style.cssText =
        "display: grid; grid-template-columns: repeat(3, 1.5rem); grid-template-rows: repeat(3, 1.5rem); gap: 1px; flex-shrink: 0;";

      const createMoveButton = (
        direction: "up" | "down" | "left" | "right",
        symbol: string,
        gridColumn: string,
        gridRow: string
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
