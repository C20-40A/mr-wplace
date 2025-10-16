/**
 * カード表示用の共通コンポーネント
 */

export interface CardConfig {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  hasActiveIcon?: boolean;
  onDelete?: boolean;
  onClick?: boolean;
  data?: Record<string, string>;
}

/**
 * 共通カードUIを生成
 */
export const createCard = (config: CardConfig): string => {
  const dataAttrs = config.data
    ? Object.entries(config.data)
        .map(([key, value]) => `data-${key}="${value}"`)
        .join(" ")
    : "";

  return `
    <div
      class="wps-card"
      data-id="${config.id}"
      ${dataAttrs}
      style="
        position: relative;
        cursor: ${config.onClick ? "pointer" : "default"};
        background: linear-gradient(180deg, #fafafb 0%, #f3f3f6 100%);
        border-radius: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        padding: 11px 14px 20px 10px;
        transition: all 0.25s ease;
        transform: translateY(0);
        overflow: hidden;
      "
      ${
        config.onClick
          ? `
        onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.12)';"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';"
        onmousedown="this.style.transform='translateY(1px) scale(0.98)';"
        onmouseup="this.style.transform='translateY(-3px) scale(1)';"
        onTouchStart="this.style.transform='translateY(1px) scale(0.98)';"
        onTouchEnd="this.style.transform='translateY(0) scale(1)';"
      `
          : ""
      }
    >
      ${
        config.onDelete
          ? `
        <!-- 削除ボタン -->
        <button
          class="wps-delete-btn"
          data-id="${config.id}"
          style="
            position: absolute;
            right: 6px;
            top: 6px;
            background: transparent;
            border: none;
            cursor: pointer;
            opacity: 0.6;
            transition: all 0.2s ease;
            transform: scale(1);
            z-index: 10;
          "
          onmouseover="event.stopPropagation(); this.style.opacity='1'; this.style.transform='scale(1.1)';"
          onmouseout="this.style.opacity='0.6'; this.style.transform='scale(1)';"
          onclick="event.stopPropagation();"
        >
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='currentColor' style='width:12px; height:12px;'>
            <path d='m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z'/>
          </svg>
        </button>
      `
          : ""
      }

      <!-- タイトル部分 -->
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 0.3rem;">
        ${
          config.hasActiveIcon
            ? `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; color: #22c55e; flex-shrink: 0;">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd" />
          </svg>
        `
            : ""
        }
        <h4 style="
          font-size: 13px;
          font-weight: 500;
          line-height: 1.4;
          color: #222;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin: 0;
          flex: 1;
        ">
          ${config.title}
        </h4>
      </div>

      ${
        config.badge
          ? `
        <!-- バッジ -->
        <div style="
          position: absolute;
          right: 8px;
          top: ${config.onDelete ? "28px" : "8px"};
          background: rgba(100, 116, 139, 0.1);
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 500;
          color: #64748b;
        ">
          ${config.badge}
        </div>
      `
          : ""
      }

      ${
        config.subtitle
          ? `
        <!-- サブタイトル（座標など） -->
        <div style="
          position: absolute;
          left: 8px;
          bottom: 6px;
          font-size: 11px;
          color: rgba(0,0,0,0.4);
          pointer-events: none;
        ">
          ${config.subtitle}
        </div>
      `
          : ""
      }
    </div>
  `;
};
