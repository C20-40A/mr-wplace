import { Tag, Bookmark } from "../types";
import { t } from "@/i18n/manager";

export const renderTagFilters = (
  tags: Tag[],
  bookmarks: Bookmark[],
  selectedTagFilters: Set<string>,
  onTagFilterChange: (tagKey: string) => void,
): void => {
  const container = document.getElementById("wps-tag-filter-container");
  const buttonsContainer = document.getElementById("wps-tag-filter-buttons");

  if (!container || !buttonsContainer) return;

  if (tags.length === 0) {
    container.style.display = "none";
    return;
  }

  const tagLatestAccess = new Map<string, number>();
  bookmarks.forEach((bookmark) => {
    if (!bookmark.tag) return;
    const tagKey = `${bookmark.tag.color}:${bookmark.tag.name || ""}`;
    const accessTime = bookmark.lastAccessedDate
      ? new Date(bookmark.lastAccessedDate).getTime()
      : 0;
    const current = tagLatestAccess.get(tagKey) || 0;
    if (accessTime > current) tagLatestAccess.set(tagKey, accessTime);
  });

  const sortedTags = [...tags].sort((a, b) => {
    const tagKeyA = `${a.color}:${a.name || ""}`;
    const tagKeyB = `${b.color}:${b.name || ""}`;
    const accessTimeA = tagLatestAccess.get(tagKeyA) || 0;
    const accessTimeB = tagLatestAccess.get(tagKeyB) || 0;
    if (accessTimeA !== accessTimeB) return accessTimeB - accessTimeA;
    return (a.name || "").localeCompare(b.name || "");
  });

  container.style.display = "block";
  buttonsContainer.innerHTML = sortedTags
    .map((tag) => {
      const tagKey = `${tag.color}:${tag.name || ""}`;
      const isSelected = selectedTagFilters.has(tagKey);
      return `
        <button
          class="wps-tag-filter-btn btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}"
          data-tag-key="${tagKey}"
          style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.5rem;">
          <div style="width: 16px; height: 16px; border-radius: 4px; background: ${tag.color};"></div>
          <span>${tag.name || t`${"no_name"}`}</span>
        </button>
      `;
    })
    .join("");

  buttonsContainer.querySelectorAll(".wps-tag-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      onTagFilterChange((btn as HTMLElement).dataset.tagKey!);
    });
  });
};
