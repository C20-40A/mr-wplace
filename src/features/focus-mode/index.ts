import { setupElementObserver } from "@/components/element-observer";
import { findTopLeftControls, findPositionModal } from "@/constants/selectors";

const BUTTON_ID = "mr-wplace-focus-mode-btn";
const EXPAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="size-3.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><polyline points="21 15 21 21 15 21"/><polyline points="3 9 3 3 9 3"/></svg>`;

let active = false;
let modalObserver: MutationObserver | null = null;

const getMap = (): HTMLElement | null =>
  document.querySelector<HTMLElement>("#map");

const activate = () => {
  const map = getMap();
  if (!map) return;
  active = true;
  map.style.zIndex = "1000";
  updateButtonStyle();
  startModalWatch();
};

const deactivate = () => {
  active = false;
  const map = getMap();
  if (map) map.style.zIndex = "";
  stopModalWatch();
  updateButtonStyle();
};

const toggle = () => {
  if (active) deactivate();
  else activate();
};

const updateButtonStyle = () => {
  const btn = document.querySelector<HTMLButtonElement>(`#${BUTTON_ID}`);
  if (!btn) return;
  btn.style.opacity = active ? "0.5" : "";
};

const startModalWatch = () => {
  stopModalWatch();
  let scheduled = false;
  modalObserver = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!active) return;
      if (findPositionModal()) deactivate();
    });
  });
  modalObserver.observe(document.body, { childList: true, subtree: true });
};

const stopModalWatch = () => {
  modalObserver?.disconnect();
  modalObserver = null;
};

const createButton = (container: Element) => {
  if (document.getElementById(BUTTON_ID)) return;

  if (container.classList.contains("gap-3")) {
    container.classList.replace("gap-3", "gap-1");
  }

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.className = "btn btn-sm btn-circle";
  btn.title = "Focus mode";
  btn.innerHTML = EXPAND_SVG;
  btn.addEventListener("click", toggle);
  container.appendChild(btn);
};

export class FocusMode {
  constructor() {
    setupElementObserver([
      {
        id: BUTTON_ID,
        getTargetElement: findTopLeftControls,
        createElement: createButton,
      },
    ]);
  }
}
