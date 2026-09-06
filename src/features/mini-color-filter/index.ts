import { setupElementObserver } from "@/components/element-observer";
import { getPaintToolbarContainer } from "@/features/paint-toolbar";
import { subscribePaintMode } from "@/utils/paint-mode";
import { colorpalette } from "@/constants/colors";
import {
  applyEnhancedMode,
  applySelectedColors,
} from "@/features/color-filter/state-actions";
import { ENHANCED_MODE_OPTIONS } from "@/components/color-palette/utils";
import { createEnhancedModeIcons } from "@/assets/enhanced-mode-icons";
import type { EnhancedMode } from "@/types/image";

const FAB_ID = "mini-color-filter-fab";
const PANEL_ID = "mini-color-filter-panel";
const STYLE_ID = "mini-color-filter-style";

const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><polygon points="3 4 21 4 14 12.5 14 20 10 18 10 12.5 3 4"/></svg>`;
const LABEL_ALL = "ALL";
const LABEL_NONE = "NONE";
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" style="width:14px;height:14px;"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const ensureStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID}{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:41;display:flex;align-items:center;gap:6px;padding:6px 8px;background:var(--color-base-100,#fff);color:var(--color-base-content,#222);border:1px solid var(--color-base-300,rgba(0,0,0,0.12));border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,0.18);max-width:calc(100vw - 16px);}
    #${PANEL_ID} .mcf-actions{display:flex;flex-direction:column;gap:2px;flex:none;align-self:stretch;justify-content:center;}
    #${PANEL_ID} .mcf-act{min-width:36px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid var(--color-base-300,rgba(0,0,0,0.12));background:transparent;color:inherit;cursor:pointer;padding:0 6px;font-size:10px;font-weight:700;letter-spacing:0.5px;line-height:1;}
    #${PANEL_ID} .mcf-act:hover{background:var(--color-base-200,rgba(0,0,0,0.06));}
    #${PANEL_ID} .mcf-act.active{background:var(--color-primary,#0f766e);color:var(--color-primary-content,#fff);}
    #${PANEL_ID} .mcf-em{position:relative;}
    #${PANEL_ID} .mcf-em-btn{display:flex;align-items:center;gap:2px;height:22px;padding:0 6px;border-radius:6px;border:1px solid var(--color-base-300,rgba(0,0,0,0.12));background:transparent;color:inherit;cursor:pointer;font-size:11px;}
    #${PANEL_ID} .mcf-em-btn img{width:16px;height:16px;image-rendering:pixelated;}
    #${PANEL_ID} .mcf-em-dropdown{position:absolute;top:calc(100% + 4px);left:0;display:none;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:6px;background:var(--color-base-100,#fff);border:1px solid var(--color-base-300,rgba(0,0,0,0.12));border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.18);z-index:42;min-width:200px;}
    #${PANEL_ID} .mcf-em-dropdown.open{display:grid;}
    #${PANEL_ID} .mcf-em-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;background:transparent;border:1.5px solid var(--color-base-300,rgba(0,0,0,0.12));border-radius:6px;cursor:pointer;color:inherit;font-size:9px;}
    #${PANEL_ID} .mcf-em-item img{width:22px;height:22px;image-rendering:pixelated;}
    #${PANEL_ID} .mcf-em-item.selected{border-color:var(--color-primary,#22c55e);background:var(--color-primary,#22c55e);color:var(--color-primary-content,#fff);}
    #${PANEL_ID} .mcf-colors{display:grid;grid-template-rows:repeat(2,auto);grid-auto-flow:column;grid-auto-columns:16px;gap:2px;overflow-x:auto;max-width:60vw;padding:2px 0;scrollbar-width:thin;scrollbar-color:rgba(0,0,0,0.18) transparent;}
    #${PANEL_ID} .mcf-colors::-webkit-scrollbar{height:3px;}
    #${PANEL_ID} .mcf-colors::-webkit-scrollbar-track{background:transparent;}
    #${PANEL_ID} .mcf-colors::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.18);border-radius:2px;}
    #${PANEL_ID} .mcf-color{width:16px;height:16px;border-radius:3px;border:1px solid rgba(0,0,0,0.2);cursor:pointer;padding:0;position:relative;}
    #${PANEL_ID} .mcf-color.off{opacity:0.25;}
    #${PANEL_ID} .mcf-color.off::after{content:"";position:absolute;inset:0;background:linear-gradient(45deg,transparent 45%,rgba(0,0,0,0.6) 45%,rgba(0,0,0,0.6) 55%,transparent 55%);border-radius:inherit;}
    #${PANEL_ID} .mcf-sep{width:1px;align-self:stretch;background:var(--color-base-300,rgba(0,0,0,0.12));margin:0 2px;}
  `;
  document.head.appendChild(style);
};

const getActiveColorIds = (): Set<number> => {
  const mgr = window.mrWplace?.colorFilterManager;
  return new Set(mgr?.getSelectedColors() ?? colorpalette.map((c) => c.id));
};

const rgbToHex = (rgb: [number, number, number]): string =>
  "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");

export class MiniColorFilter {
  private panel: HTMLDivElement | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor() {
    ensureStyles();
    setupElementObserver([
      {
        id: FAB_ID,
        getTargetElement: getPaintToolbarContainer,
        createElement: (host) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip tooltip-bottom";
          tooltip.setAttribute("data-tip", "Mini Color Filter");

          const btn = document.createElement("button");
          btn.id = FAB_ID;
          btn.type = "button";
          btn.className = "btn btn-sm btn-circle btn-ghost";
          btn.innerHTML = ICON_FILTER;
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.togglePanel();
          });

          tooltip.appendChild(btn);
          host.appendChild(tooltip);
        },
      },
    ]);

    // paint mode を抜けたら片付け (FAB は toolbar ごと消える)
    subscribePaintMode((active) => {
      if (active) return;
      this.closePanel();
    });
  }

  private togglePanel(): void {
    if (this.panel) {
      this.closePanel();
      return;
    }
    this.openPanel();
  }

  private closePanel(): void {
    this.panel?.remove();
    this.panel = null;
    if (this.outsideClickHandler) {
      document.removeEventListener("click", this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  private openPanel(): void {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    this.panel = panel;

    const actions = document.createElement("div");
    actions.className = "mcf-actions";
    panel.appendChild(actions);

    const mkAct = (
      content: string,
      title: string,
      onClick: () => void,
      asHtml = false,
    ): HTMLButtonElement => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mcf-act";
      b.title = title;
      if (asHtml) b.innerHTML = content;
      else b.textContent = content;
      b.addEventListener("click", onClick);
      return b;
    };

    actions.appendChild(
      mkAct(LABEL_ALL, "All", async () => {
        await applySelectedColors(colorpalette.map((c) => c.id));
        this.refreshColors();
      }),
    );
    actions.appendChild(
      mkAct(LABEL_NONE, "None", async () => {
        await applySelectedColors([]);
        this.refreshColors();
      }),
    );

    const sep1 = document.createElement("div");
    sep1.className = "mcf-sep";
    panel.appendChild(sep1);

    panel.appendChild(this.buildEnhancedModeSelect());

    const sep2 = document.createElement("div");
    sep2.className = "mcf-sep";
    panel.appendChild(sep2);

    const colors = document.createElement("div");
    colors.className = "mcf-colors";
    panel.appendChild(colors);

    const sep3 = document.createElement("div");
    sep3.className = "mcf-sep";
    panel.appendChild(sep3);

    panel.appendChild(mkAct(ICON_CLOSE, "Close", () => this.closePanel(), true));

    document.body.appendChild(panel);
    // toolbar のアイコン一覧の直下に出す
    const toolbar = getPaintToolbarContainer();
    if (toolbar) panel.style.top = `${toolbar.getBoundingClientRect().bottom + 6}px`;
    this.refreshColors();

    // パネル外クリックで dropdown を閉じる
    this.outsideClickHandler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.contains(target)) return;
      if (!(target instanceof Element)) return;
      if (!target.closest(".mcf-em")) {
        this.closeEnhancedDropdown();
      }
    };
    document.addEventListener("click", this.outsideClickHandler);
  }

  private buildEnhancedModeSelect(): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.className = "mcf-em";

    const mgr = window.mrWplace?.colorFilterManager;
    const currentMode: EnhancedMode = mgr?.getEnhancedMode() ?? "cross";
    const enhancedColor = mgr?.getEnhancedColor() ?? [255, 0, 0];
    const icons = createEnhancedModeIcons(rgbToHex(enhancedColor));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mcf-em-btn";
    btn.title = "Enhanced mode";
    btn.innerHTML = `<img src="${icons[currentMode]}" alt="${currentMode}">`;
    wrap.appendChild(btn);

    const dropdown = document.createElement("div");
    dropdown.className = "mcf-em-dropdown";
    wrap.appendChild(dropdown);

    const renderItems = (): void => {
      const mgr2 = window.mrWplace?.colorFilterManager;
      const mode = mgr2?.getEnhancedMode() ?? "cross";
      const color = mgr2?.getEnhancedColor() ?? [255, 0, 0];
      const items = createEnhancedModeIcons(rgbToHex(color));
      dropdown.innerHTML = "";
      for (const opt of ENHANCED_MODE_OPTIONS) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `mcf-em-item${opt.value === mode ? " selected" : ""}`;
        item.title = opt.value;
        item.innerHTML = `<img src="${items[opt.value]}" alt="${opt.value}"><span>${opt.value}</span>`;
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          applyEnhancedMode(opt.value);
          btn.innerHTML = `<img src="${items[opt.value]}" alt="${opt.value}">`;
          renderItems();
          this.closeEnhancedDropdown();
        });
        dropdown.appendChild(item);
      }
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      if (isOpen) {
        dropdown.classList.remove("open");
        return;
      }
      renderItems();
      dropdown.classList.add("open");
    });

    return wrap;
  }

  private closeEnhancedDropdown(): void {
    this.panel?.querySelector(".mcf-em-dropdown")?.classList.remove("open");
  }

  private refreshColors(): void {
    if (!this.panel) return;
    const container = this.panel.querySelector<HTMLDivElement>(".mcf-colors");
    if (!container) return;
    const active = getActiveColorIds();
    container.innerHTML = "";
    for (const c of colorpalette) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `mcf-color${active.has(c.id) ? "" : " off"}`;
      b.style.backgroundColor = `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})`;
      b.title = c.name;
      b.addEventListener("click", async () => {
        const cur = getActiveColorIds();
        if (cur.has(c.id)) cur.delete(c.id);
        else cur.add(c.id);
        await applySelectedColors([...cur]);
        this.refreshColors();
      });
      b.addEventListener("dblclick", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await applySelectedColors([c.id]);
        this.refreshColors();
      });
      container.appendChild(b);
    }
  }
}
