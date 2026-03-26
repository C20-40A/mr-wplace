export const INTERACTIVE_BASE_STYLE =
  "user-select: none; -webkit-tap-highlight-color: transparent;";

export const HANDLERS_SCALE_98 = `
  onmousedown="this.style.transform='scale(0.98)';"
  onmouseup="this.style.transform='scale(1)';"
  ontouchstart="this.style.transform='scale(0.98)';"
  ontouchend="this.style.transform='scale(1)';"
`;

export const HANDLERS_SCALE_95 = `
  onmousedown="this.style.transform='scale(0.95)';"
  onmouseup="this.style.transform='scale(1)';"
  ontouchstart="this.style.transform='scale(0.95)';"
  ontouchend="this.style.transform='scale(1)';"
`;

export const HANDLERS_BORDER_HOVER = (baseColor: string) => `
  onmouseenter="this.style.borderColor='#22c55e';"
  onmouseleave="this.style.borderColor='${baseColor}';"
`;

const getControlHeight = (isXs: boolean): string =>
  isXs ? "1.8rem" : "2.25rem";

export const getCommonBaseStyle = (isXs: boolean): string => `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1;
  border-radius: 9999px;
  height: ${getControlHeight(isXs)};
  min-height: ${getControlHeight(isXs)};
  ${INTERACTIVE_BASE_STYLE}
`;

export const getDropdownTriggerBaseStyle = (
  isXs: boolean,
  fullWidth: boolean = false,
): string => `
  ${getCommonBaseStyle(isXs)}
  padding: ${isXs ? "0 0.5rem" : "0 0.75rem"};
  border: 2px solid #d1d5db;
  gap: 0.5rem;
  ${fullWidth ? "width: 100%;" : ""}
`;

type DropdownItemConfig<T> = {
  options: readonly T[];
  isXs: boolean;
  selected: (option: T) => boolean;
  itemClass: string;
  dataAttr: string;
  getValue: (option: T) => string;
  getLabel: (option: T) => string;
  getDescription?: (option: T) => string;
  getIcon?: (option: T) => string;
  padding: {
    xs: string;
    default: string;
  };
};

export const buildDropdownItems = <T>({
  options,
  isXs,
  selected,
  itemClass,
  dataAttr,
  getValue,
  getLabel,
  getDescription,
  getIcon,
  padding,
}: DropdownItemConfig<T>): string =>
  options
    .map((option) => {
      const isSelected = selected(option);
      const borderColor = isSelected
        ? "#22c55e"
        : "var(--color-base-content, #e5e7eb)";
      const borderWidth = isSelected ? "2px" : "1px";
      const bgColor = isSelected
        ? "var(--color-primary, #22c55e)"
        : "var(--color-base-300, #f9fafb)";
      const textColor = isSelected
        ? "var(--color-primary-content, #fff)"
        : "var(--color-base-content, inherit)";
      const hoverBgColor = isSelected
        ? "var(--color-primary, #dcfce7)"
        : "var(--color-base-200, #f0f0f0)";
      const iconHtml = getIcon ? getIcon(option) : "";
      const description = getDescription?.(option);

      return `
        <button class="${itemClass}"
                ${dataAttr}="${getValue(option)}"
                type="button"
                style="padding: ${isXs ? padding.xs : padding.default};
                       background-color: ${bgColor};
                       border: ${borderWidth} solid ${borderColor};
                       border-radius: 0.375rem;
                       cursor: pointer;
                       text-align: left;
                       font-size: ${isXs ? "0.75rem" : "0.875rem"};
                       transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                       font-weight: ${isSelected ? "600" : "400"};
                       color: ${textColor};
                       ${INTERACTIVE_BASE_STYLE}
                       ${getIcon ? "display: flex; align-items: center; gap: 0.5rem;" : ""}
                onmouseenter="this.style.backgroundColor='${hoverBgColor}'; this.style.transform='translateX(4px)'; this.style.borderColor='#22c55e';"
                onmouseleave="this.style.backgroundColor='${bgColor}'; this.style.transform='translateX(0)'; this.style.borderColor='${borderColor}';"
                onmousedown="this.style.transform='scale(0.98)';"
                onmouseup="this.style.transform='translateX(4px)';"
                ontouchstart="this.style.transform='scale(0.98)';"
                ontouchend="this.style.transform='scale(1)';">
          ${iconHtml}
          <span style="display: flex; flex-direction: column; gap: 0.05rem;">
            <span>${getLabel(option)}</span>
            ${
              description
                ? `<span style="font-size: ${isXs ? "0.65rem" : "0.72rem"}; font-weight: 500; opacity: 0.82;">${description}</span>`
                : ""
            }
          </span>
        </button>
      `;
    })
    .join("");

export const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
