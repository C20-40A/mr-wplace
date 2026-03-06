const LOADING_INDICATOR_ID = "loading-indicator";

interface LoadingIndicatorOptions {
  id?: string;
  text?: string;
  minHeight?: string;
}

const animateDot = (dot: HTMLDivElement, delay: number) => {
  dot.animate(
    [
      { opacity: "0.25", transform: "scale(0.85)" },
      { opacity: "1", transform: "scale(1)" },
      { opacity: "0.25", transform: "scale(0.85)" },
    ],
    {
      duration: 900,
      delay,
      iterations: Number.POSITIVE_INFINITY,
      easing: "ease-in-out",
    },
  );
};

export const createLoadingIndicator = (
  options: LoadingIndicatorOptions = {},
): HTMLDivElement => {
  const loading = document.createElement("div");
  loading.id = options.id || LOADING_INDICATOR_ID;
  loading.setAttribute("aria-live", "polite");
  loading.setAttribute("aria-busy", "true");
  loading.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    `min-height:${options.minHeight || "96px"}`,
    "gap:10px",
    "width:100%",
  ].join(";");

  const dots = document.createElement("div");
  dots.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;";

  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.style.cssText = [
      "width:8px",
      "height:8px",
      "border-radius:9999px",
      "background:#fff",
      "opacity:0.25",
      "transform:scale(0.85)",
    ].join(";");
    animateDot(dot, i * 150);
    dots.appendChild(dot);
  }

  loading.appendChild(dots);

  if (options.text) {
    const text = document.createElement("div");
    text.textContent = options.text;
    text.style.cssText = "font-size:12px;line-height:1.4;opacity:0.8;text-align:center;";
    loading.appendChild(text);
  }

  return loading;
};

export const mountLoadingIndicator = (
  target: HTMLElement,
  options: LoadingIndicatorOptions = {},
): HTMLDivElement => {
  const id = options.id || LOADING_INDICATOR_ID;
  const existing = document.getElementById(id) as HTMLDivElement | null;
  if (existing) return existing;

  const loading = createLoadingIndicator(options);
  target.before(loading);
  return loading;
};

export const renderLoadingIndicator = (
  target: HTMLElement,
  options: LoadingIndicatorOptions = {},
): HTMLDivElement => {
  const loading = createLoadingIndicator(options);
  target.replaceChildren(loading);
  return loading;
};

export const removeLoadingIndicator = (id = LOADING_INDICATOR_ID): void => {
  document.getElementById(id)?.remove();
};
