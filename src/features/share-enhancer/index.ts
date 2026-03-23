import { findShareModalUrlContainer } from "@/constants/selectors";
import { latLngToTilePixel } from "@/utils/coordinate";

const ROW_ID = "mr-wplace-share-short-coords";

const parseCoordinates = (text: string): { lat: number; lng: number } | null => {
  const match = text.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
};

const findCoordinatesDiv = (modalBox: Element): HTMLElement | null => {
  for (const div of modalBox.querySelectorAll("div.text-xs")) {
    if (div.querySelector("span.font-semibold") && div.textContent?.match(/-?\d+\.\d{3,}/))
      return div as HTMLElement;
  }
  return null;
};

const shortenUrl = (url: string): string =>
  url.replace(/(-?\d+\.\d{5,})/g, (m) => parseFloat(m).toFixed(4));

const buildShortRow = (coords: { lat: number; lng: number }): HTMLDivElement => {
  const { TLX, TLY, PxX, PxY } = latLngToTilePixel(coords.lat, coords.lng);
  const shortLatLng = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
  const pixelCoord = `${TLX}-${TLY}-${PxX}-${PxY}`;

  const row = document.createElement("div");
  row.id = ROW_ID;
  row.className = "text-base-content/60 mt-1 flex items-center gap-1.5 text-xs";

  const text = document.createElement("span");
  text.textContent = `${shortLatLng} | ${pixelCoord}`;
  text.style.fontFamily = "monospace";

  const sep = document.createElement("span");
  sep.textContent = "|";
  sep.style.opacity = "0.4";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn btn-xs btn-ghost gap-1";
  copyBtn.style.cssText = "padding: 0 5px; min-height: 1.25rem; height: 1.25rem;";
  copyBtn.title = "Copy short URL";
  copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:11px;height:11px;"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg><span style="font-size:10px;">Copy Short URL</span>`;

  copyBtn.addEventListener("click", async () => {
    const modalBox = row.closest(".modal-box");
    const input = modalBox?.querySelector("input[readonly]") as HTMLInputElement | null;
    const shortUrl = input?.value ? shortenUrl(input.value) : shortLatLng;

    await navigator.clipboard.writeText(shortUrl);

    const label = copyBtn.querySelector("span")!;
    const prev = label.textContent;
    label.textContent = "Copied!";
    setTimeout(() => (label.textContent = prev), 1200);
  });

  row.appendChild(text);
  row.appendChild(sep);
  row.appendChild(copyBtn);
  return row;
};

const inject = (modalBox: Element): void => {
  if (modalBox.querySelector(`#${ROW_ID}`)) return;
  if (!findShareModalUrlContainer(modalBox)) return;

  const coordDiv = findCoordinatesDiv(modalBox);
  if (!coordDiv) return;

  const coords = parseCoordinates(coordDiv.textContent || "");
  if (!coords) return;

  coordDiv.after(buildShortRow(coords));
};

const observeShareModal = (): void => {
  const observer = new MutationObserver(() => {
    for (const modalBox of document.querySelectorAll(".modal-box")) {
      if (findShareModalUrlContainer(modalBox)) inject(modalBox);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

export const initShareEnhancer = (): void => {
  observeShareModal();
  console.log("🧑‍🎨 : ShareEnhancer initialized");
};
