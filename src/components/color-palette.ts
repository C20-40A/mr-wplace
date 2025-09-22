import { colorpalette } from "../constants/colors";

interface ColorPaletteOptions {
  onChange?: (colorIds: number[]) => void;
  selectedColorIds?: number[];
}

const enabledBadgeHTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #22c55e; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">✓</span>';
const disabledBadgeHTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #ef4444; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">x</span>';

/**
 * カラーパレット表示コンポーネント
 * 色をクリックで選択状態を変更（緑枠=選択、赤枠=未選択）
 */
export class ColorPalette {
  private container: HTMLElement;
  private options: ColorPaletteOptions;
  private selectedColorIds: Set<number> = new Set();

  constructor(container: HTMLElement, options: ColorPaletteOptions = {}) {
    this.container = container;
    this.options = options;
    // 初期状態で全色選択
    this.selectedColorIds = new Set(
      options.selectedColorIds ?? colorpalette.map((c) => c.id)
    );

    this.init();
  }

  private init(): void {
    this.createPaletteUI();
    this.setupEventHandlers();
  }

  private createPaletteUI(): void {
    const paletteGrid = colorpalette
      .map((color) => {
        const [r, g, b] = color.rgb;
        const backgroundColor = `rgb(${r}, ${g}, ${b})`;
        const textColor = this.getContrastTextColor(r, g, b);
        const isSelected = this.selectedColorIds.has(color.id);
        const borderColor = isSelected ? "#22c55e" : "#ef4444"; // green-500 : red-500

        const premiumIcon = color.premium
          ? '<span style="position: absolute; right: 0.25rem; top: 0.25rem; font-size: 0.75rem;">💧</span>'
          : "";
        const enabledBadge = isSelected ? enabledBadgeHTML : disabledBadgeHTML;

        return `
        <div class="color-item cursor-pointer p-2 text-xs font-medium flex items-center justify-center min-h-[3rem]"
             style="background-color: ${backgroundColor}; color: ${textColor}; border-color: ${borderColor}; position: relative; 
             border-radius: 0.5rem; border-style: solid; border-width: 3px;"
             data-color-id="${color.id}"
             title="${color.name} (${color.premium ? "Premium" : "Free"})">
          ${enabledBadge}
          ${color.name}
          ${premiumIcon}
        </div>
      `;
      })
      .join("");

    this.container.innerHTML = `
      <div class="color-palette-controls flex gap-2 mb-4 px-4 pt-4">
        <button class="enable-all-btn btn btn-outline btn-success btn-sm rounded">Enable All</button>
        <button class="disable-all-btn btn btn-outline btn-error btn-sm rounded">Disable All</button>
      </div>
      <div class="color-palette-grid grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 px-4 pb-4">
        ${paletteGrid}
      </div>
    `;
  }

  private setupEventHandlers(): void {
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Enable All ボタン
      if (target.classList.contains("enable-all-btn")) {
        this.enableAll();
        return;
      }

      // Disable All ボタン
      if (target.classList.contains("disable-all-btn")) {
        this.disableAll();
        return;
      }

      // 色選択
      const colorItem = target.closest(".color-item");
      if (!colorItem) return;

      const colorId = parseInt((colorItem as HTMLElement).dataset.colorId!);
      this.toggleColor(colorId);
    });
  }

  private toggleColor(colorId: number): void {
    if (this.selectedColorIds.has(colorId)) {
      this.selectedColorIds.delete(colorId);
    } else {
      this.selectedColorIds.add(colorId);
    }
    this.updateSelection();
    this.notifyChange();
  }

  private enableAll(): void {
    this.selectedColorIds = new Set(colorpalette.map((c) => c.id));
    this.updateSelection();
    this.notifyChange();
  }

  private disableAll(): void {
    this.selectedColorIds.clear();
    this.updateSelection();
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.options.onChange) {
      this.options.onChange(Array.from(this.selectedColorIds));
    }
  }

  private updateSelection(): void {
    const colorItems = this.container.querySelectorAll(".color-item");
    colorItems.forEach((item) => {
      const itemColorId = parseInt((item as HTMLElement).dataset.colorId!);
      const isSelected = this.selectedColorIds.has(itemColorId);
      const borderColor = isSelected ? "#22c55e" : "#ef4444";

      (item as HTMLElement).style.borderColor = borderColor;

      // バッジ更新
      const existingBadge = item.querySelector(".badge-status");
      if (existingBadge) {
        const newBadge = isSelected ? enabledBadgeHTML : disabledBadgeHTML;
        existingBadge.outerHTML = newBadge;
      }
    });
  }

  private getContrastTextColor(r: number, g: number, b: number): string {
    // RGB輝度計算（ITU-R BT.709）
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }

  setSelectedColors(colorIds: number[]): void {
    this.selectedColorIds = new Set(colorIds);
    this.updateSelection();
  }

  destroy(): void {
    this.container.innerHTML = "";
  }
}
