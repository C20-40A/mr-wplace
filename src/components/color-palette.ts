import { colorpalette } from "../constants/colors";

interface ColorPaletteOptions {
  onChange?: (colorId: number) => void;
  selectedColorId?: number;
}

/**
 * カラーパレット表示コンポーネント
 * 色をクリックで選択状態を変更（緑枠=選択、赤枠=未選択）
 */
export class ColorPalette {
  private container: HTMLElement;
  private options: ColorPaletteOptions;
  private selectedColorId: number | null = null;

  constructor(container: HTMLElement, options: ColorPaletteOptions = {}) {
    this.container = container;
    this.options = options;
    this.selectedColorId = options.selectedColorId ?? null;
    
    this.init();
  }

  private init(): void {
    this.createPaletteUI();
    this.setupEventHandlers();
  }

  private createPaletteUI(): void {
    const paletteGrid = colorpalette.map(color => {
      const [r, g, b] = color.rgb;
      const backgroundColor = `rgb(${r}, ${g}, ${b})`;
      const textColor = this.getContrastTextColor(r, g, b);
      const isSelected = this.selectedColorId === color.id;
      const borderColor = isSelected ? '#22c55e' : '#ef4444'; // green-500 : red-500
      
      return `
        <div class="color-item cursor-pointer border-2 p-2 text-xs font-medium flex items-center justify-center min-h-[3rem] transition-all duration-150 hover:scale-105"
             style="background-color: ${backgroundColor}; color: ${textColor}; border-color: ${borderColor};"
             data-color-id="${color.id}"
             title="${color.name} (${color.premium ? 'Premium' : 'Free'})">
          ${color.name}
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="color-palette-grid grid grid-cols-8 gap-2 p-4">
        ${paletteGrid}
      </div>
    `;
  }

  private setupEventHandlers(): void {
    this.container.addEventListener('click', (e) => {
      const colorItem = (e.target as HTMLElement).closest('.color-item');
      if (!colorItem) return;

      const colorId = parseInt((colorItem as HTMLElement).dataset.colorId!);
      this.selectColor(colorId);
    });
  }

  private selectColor(colorId: number): void {
    this.selectedColorId = colorId;
    this.updateSelection();
    
    if (this.options.onChange) {
      this.options.onChange(colorId);
    }
  }

  private updateSelection(): void {
    const colorItems = this.container.querySelectorAll('.color-item');
    colorItems.forEach((item) => {
      const itemColorId = parseInt((item as HTMLElement).dataset.colorId!);
      const isSelected = itemColorId === this.selectedColorId;
      const borderColor = isSelected ? '#22c55e' : '#ef4444';
      
      (item as HTMLElement).style.borderColor = borderColor;
    });
  }

  private getContrastTextColor(r: number, g: number, b: number): string {
    // RGB輝度計算（ITU-R BT.709）
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  getSelectedColor(): number | null {
    return this.selectedColorId;
  }

  setSelectedColor(colorId: number | null): void {
    this.selectedColorId = colorId;
    this.updateSelection();
  }

  destroy(): void {
    this.container.innerHTML = "";
  }
}
