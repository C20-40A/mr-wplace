import { Bookmark } from "../types";
import { t } from "@/i18n/manager";
import { createCard, CardConfig, attachCardScrollPassthrough } from "@/components/card";
import { runtime } from "@/utils/browser-api";
import { showFeatureHint } from "@/features/feature-hints";

export type BookmarkSortType = "created" | "accessed" | "tag";

export const renderBookmarks = (
  favorites: Bookmark[],
  sortType: BookmarkSortType = "created",
  selectedTagFilters: Set<string> = new Set(),
): void => {
  const grid = document.getElementById("wps-favorites-grid") as HTMLElement;
  const emptyState = document.getElementById("wps-favorites-empty") as HTMLElement;

  if (!grid || !emptyState) return;

  let filteredFavorites = favorites;
  if (selectedTagFilters.size > 0) {
    filteredFavorites = favorites.filter((fav) => {
      if (!fav.tag) return false;
      return selectedTagFilters.has(`${fav.tag.color}:${fav.tag.name || ""}`);
    });
  }

  if (filteredFavorites.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "block";
    const emptyStateImageUrl = runtime.getURL(
      "assets/images/bookmark/bookmark-button-location.png",
    );
    emptyState.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100%; padding: 1rem; gap: 1.5rem; max-width: 90%; width: 100%; margin: 0 auto; box-sizing: border-box;">
          <img src="${emptyStateImageUrl}" alt="How to bookmark" style="max-width: 18rem; width: 100%; height: auto; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          <div style="text-align: center; width: 100%;">
            <p style="font-size: 1rem; margin-bottom: 0.5rem; color: var(--bc); opacity: 0.8;">${t`${"empty_bookmark_message"}`}</p>
          </div>
        </div>
      `;
    return;
  }

  emptyState.style.display = "none";
  emptyState.innerHTML = "";
  grid.style.display = "grid";

  if (sortType === "created") {
    filteredFavorites.sort((a, b) => b.id - a.id);
  } else if (sortType === "accessed") {
    filteredFavorites.sort((a, b) => {
      if (!a.lastAccessedDate && !b.lastAccessedDate) return b.id - a.id;
      if (!a.lastAccessedDate) return 1;
      if (!b.lastAccessedDate) return -1;
      return (
        new Date(b.lastAccessedDate).getTime() -
        new Date(a.lastAccessedDate).getTime()
      );
    });
  } else if (sortType === "tag") {
    const tagLatestAccess = new Map<string, number>();
    filteredFavorites.forEach((fav) => {
      if (!fav.tag) return;
      const tagKey = `${fav.tag.color}:${fav.tag.name || ""}`;
      const accessTime = fav.lastAccessedDate
        ? new Date(fav.lastAccessedDate).getTime()
        : 0;
      const current = tagLatestAccess.get(tagKey) || 0;
      if (accessTime > current) tagLatestAccess.set(tagKey, accessTime);
    });

    filteredFavorites.sort((a, b) => {
      if (!a.tag && !b.tag) return b.id - a.id;
      if (!a.tag) return 1;
      if (!b.tag) return -1;

      const tagKeyA = `${a.tag.color}:${a.tag.name || ""}`;
      const tagKeyB = `${b.tag.color}:${b.tag.name || ""}`;
      const accessTimeA = tagLatestAccess.get(tagKeyA) || 0;
      const accessTimeB = tagLatestAccess.get(tagKeyB) || 0;

      if (accessTimeA !== accessTimeB) return accessTimeB - accessTimeA;

      const tagNameA = a.tag.name || "";
      const tagNameB = b.tag.name || "";
      if (tagNameA !== tagNameB) return tagNameA.localeCompare(tagNameB);

      if (!a.lastAccessedDate && !b.lastAccessedDate) return b.id - a.id;
      if (!a.lastAccessedDate) return 1;
      if (!b.lastAccessedDate) return -1;
      return (
        new Date(b.lastAccessedDate).getTime() -
        new Date(a.lastAccessedDate).getTime()
      );
    });
  }

  grid.innerHTML = filteredFavorites
    .map((fav) => {
      const cardConfig: CardConfig = {
        id: fav.id.toString(),
        title: fav.name,
        padding: "11px 14px 10px 10px",
        onDelete: true,
        onEdit: true,
        onClick: true,
        tagColor: fav.tag?.color,
        tagName: fav.tag?.name,
        data: {
          lat: fav.lat.toString(),
          lng: fav.lng.toString(),
          zoom: fav.zoom.toString(),
        },
      };
      return createCard(cardConfig);
    })
    .join("");

  attachCardScrollPassthrough(grid);

  const firstEditBtn = grid.querySelector(".wps-edit-btn");
  if (firstEditBtn instanceof HTMLElement)
    showFeatureHint("edit-card", firstEditBtn);
};
