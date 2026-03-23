import { findShareModalUrlContainer } from "@/constants/selectors";

const BTN_ID = "mr-wplace-short-coord-copy";

const shortenCoords = (text: string): string =>
  text.replace(/(-?\d+\.\d{5,})/g, (m) => parseFloat(m).toFixed(4));

const findCoordinatesDiv = (modalBox: Element): HTMLElement | null => {
  const divs = modalBox.querySelectorAll("div.text-xs");
  for (const div of divs) {
    if (div.querySelector("span.font-semibold") && div.textContent?.match(/-?\d+\.\d{3,}/))
      return div as HTMLElement;
  }
  return null;
};

const buildShortUrl = (modalBox: Element): string | null => {
  const input = modalBox.querySelector("input[readonly]") as HTMLInputElement;
  if (!input?.value) return null;
  return shortenCoords(input.value);
};

const injectCopyShortButton = (modalBox: Element): void => {
  if (modalBox.querySelector(`#${BTN_ID}`)) return;
  if (!findShareModalUrlContainer(modalBox)) return;

  const coordDiv = findCoordinatesDiv(modalBox);
  if (!coordDiv) return;

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.className = "btn btn-xs btn-ghost";
  btn.style.cssText = "margin-left: 4px; vertical-align: middle; padding: 0 6px; min-height: 1.25rem; height: 1.25rem;";
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:12px;height:12px;"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg> <span style="font-size:10px;">Short</span>`;
  btn.title = "Copy short URL";

  btn.addEventListener("click", async () => {
    const shortUrl = buildShortUrl(modalBox);
    if (!shortUrl) return;

    await navigator.clipboard.writeText(shortUrl);

    const label = btn.querySelector("span")!;
    const original = label.textContent;
    label.textContent = "Copied!";
    setTimeout(() => (label.textContent = original), 1200);
  });

  coordDiv.appendChild(btn);
};

const observeShareModal = (): void => {
  const observer = new MutationObserver(() => {
    const modalBoxes = document.querySelectorAll(".modal-box");
    for (const modalBox of modalBoxes) {
      if (findShareModalUrlContainer(modalBox)) injectCopyShortButton(modalBox);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
};

export const initShareEnhancer = (): void => {
  observeShareModal();
  console.log("🧑‍🎨 : ShareEnhancer initialized");
};
