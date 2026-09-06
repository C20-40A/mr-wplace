import {
  getAllGalleryMetadata,
  getGalleryThumbnailDataUrl,
} from "@/core/bridge/gallery-storage-bridge";
import type { GalleryMetadata } from "@/core/bridge/gallery-storage-bridge";
import {
  selectPaintTemplate,
  subscribePaintTemplateProgress,
  type PaintTemplateProgress,
} from "@/features/paint-stats";
import { registerPaintToolbarButton } from "@/features/paint-toolbar";
import { getAggregatedColorStats } from "@/utils/inject-bridge";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { getCurrentPosition, gotoPosition } from "@/utils/position";

const BUTTON_ID = "paint-template-indicator";

const percentageFromStats = (
  stats: Record<string, { matched: number; total: number }>,
): number | null => {
  const totals = Object.values(stats).reduce(
    (sum, stat) => ({
      matched: sum.matched + stat.matched,
      total: sum.total + stat.total,
    }),
    { matched: 0, total: 0 },
  );
  return totals.total > 0 ? Math.round((totals.matched / totals.total) * 100) : null;
};

const getTemplatePercentage = async (
  template: Pick<GalleryMetadata, "id" | "perTileStats">,
): Promise<number | null> => {
  try {
    const livePercentage = percentageFromStats(
      await getAggregatedColorStats([template.id]),
    );
    if (livePercentage !== null) return livePercentage;
  } catch {
    // Fall through to the saved per-tile stats.
  }

  if (!template.perTileStats) return null;
  const savedStats: Record<string, { matched: number; total: number }> = {};
  for (const tileStats of Object.values(template.perTileStats)) {
    for (const [color, count] of Object.entries(tileStats.matched)) {
      savedStats[color] ??= { matched: 0, total: 0 };
      savedStats[color].matched += count;
    }
    for (const [color, count] of Object.entries(tileStats.total)) {
      savedStats[color] ??= { matched: 0, total: 0 };
      savedStats[color].total += count;
    }
  }
  return percentageFromStats(savedStats);
};

interface TemplateSummary {
  id: string;
  title?: string;
}

export class PaintTemplateIndicator {
  private button: HTMLButtonElement | null = null;
  private menu: HTMLDivElement | null = null;
  private progress: PaintTemplateProgress | null = null;
  private currentTemplate: TemplateSummary | null = null;
  private hasTemplates = false;

  constructor() {
    subscribePaintTemplateProgress((progress) => {
      this.progress = progress;
      if (progress) {
        this.currentTemplate = { id: progress.id, title: progress.title };
        this.hasTemplates = true;
      }
      this.renderCurrent();
    });
    void this.refreshAvailability();

    registerPaintToolbarButton({
      id: BUTTON_ID,
      tip: "テンプレートを選択",
      icon: "",
      className: "btn btn-sm btn-ghost",
      onClick: () => void this.toggleMenu(),
      onCreate: (button) => {
        this.button = button;
        button.style.cssText =
          "position:relative;width:34px;height:32px;min-height:32px;padding:1px;overflow:visible;";
        this.renderCurrent();
      },
    });
  }

  private async refreshAvailability(): Promise<void> {
    const metadata = await getAllGalleryMetadata();
    this.hasTemplates = metadata.some((item) => item.visible && item.coords);
    this.renderCurrent();
  }

  private renderCurrent(): void {
    if (!this.button) return;
    this.button.style.display = this.hasTemplates ? "inline-flex" : "none";

    const template = this.currentTemplate;
    const percent = this.progress?.id === template?.id
      ? `${Math.round(this.progress.percentage)}%`
      : "—";
    this.button.title = template?.title || "テンプレートを選択";
    this.button.innerHTML = `
      <span class="mr-template-percent">${percent}</span>
      <img class="mr-template-thumb" alt="" />
    `;
    if (!template) return;

    const img = this.button.querySelector("img")!;
    void getGalleryThumbnailDataUrl(template.id).then((thumbnail) => {
      if (this.currentTemplate?.id === template.id && thumbnail) img.src = thumbnail;
    });
  }

  private async toggleMenu(): Promise<void> {
    if (this.menu) {
      this.closeMenu();
      return;
    }
    if (!this.button) return;

    const menu = document.createElement("div");
    menu.className = "mr-template-menu";
    menu.textContent = "読み込み中…";
    this.button.parentElement?.appendChild(menu);
    this.menu = menu;

    const metadata = await getAllGalleryMetadata();
    const templates = metadata
      .filter(
        (item): item is typeof item & { coords: NonNullable<typeof item.coords> } =>
          item.visible && !!item.coords,
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    this.hasTemplates = templates.length > 0;
    this.renderCurrent();
    if (this.menu !== menu) return;
    menu.replaceChildren();
    if (templates.length === 0) {
      menu.textContent = "配置済みテンプレートはありません";
      return;
    }

    templates.forEach((template) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "mr-template-menu-item";
      row.innerHTML =
        '<img alt="" /><span><strong class="mr-template-menu-progress"></strong><i class="mr-template-menu-meter"><b></b></i><small class="mr-template-menu-title"></small></span>';
      const title = row.querySelector(".mr-template-menu-title") as HTMLSpanElement;
      if (template.title) title.textContent = template.title;
      row.addEventListener("click", () => {
        this.currentTemplate = { id: template.id, title: template.title };
        this.renderCurrent();
        selectPaintTemplate(template.id);
        this.jumpToTemplate(template);
        this.closeMenu();
      });
      menu.appendChild(row);
      void getGalleryThumbnailDataUrl(template.id).then((thumbnail) => {
        const image = row.querySelector("img");
        if (thumbnail && image) image.src = thumbnail;
      });
      void getTemplatePercentage(template).then((percentage) => {
        if (percentage === null) return;
        const label = row.querySelector(".mr-template-menu-progress");
        const meter = row.querySelector(".mr-template-menu-meter") as HTMLElement;
        const fill = meter?.querySelector("b") as HTMLElement;
        if (label) label.textContent = percentage + "%";
        if (meter && fill) {
          meter.style.display = "block";
          fill.style.width = percentage + "%";
        }
      });
    });

    document.addEventListener("pointerdown", this.closeOnOutside, { capture: true });
  }

  private jumpToTemplate(template: {
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    width: number;
    height: number;
  }): void {
    const { TLX, TLY, PxX, PxY } = template.coords;
    const position = tilePixelToLatLng(
      TLX,
      TLY,
      PxX + template.width / 2,
      PxY + template.height / 2,
    );
    void gotoPosition({ ...position, zoom: getCurrentPosition()?.zoom ?? 13 });
  }

  private closeOnOutside = (event: PointerEvent): void => {
    if (this.menu && !this.menu.parentElement?.contains(event.target as Node))
      this.closeMenu();
  };

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
    document.removeEventListener("pointerdown", this.closeOnOutside, {
      capture: true,
    });
  }
};
