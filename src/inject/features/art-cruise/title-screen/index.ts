type ArtCruiseTitleScreenOptions = {
  fontStack: string;
  onStart: () => void;
  onBossMode: () => void;
  onExit: () => void;
};

export class ArtCruiseTitleScreen {
  private root: HTMLDivElement | null = null;

  constructor(private readonly options: ArtCruiseTitleScreenOptions) {}

  mount = () => {
    if (this.root) return;

    const root = document.createElement("div");
    root.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1003;
      display: grid;
      place-items: center;
      pointer-events: auto;
      overflow: hidden;
      font-family: ${this.options.fontStack};
      color: #e0faff;
      background:
        radial-gradient(circle at 50% 28%, rgba(244, 114, 182, 0.22), transparent 24%),
        radial-gradient(circle at 52% 62%, rgba(34, 211, 238, 0.2), transparent 36%),
        linear-gradient(180deg, rgba(2, 6, 23, 0.24), rgba(2, 6, 23, 0.72));
    `;

    const panel = document.createElement("div");
    panel.style.cssText = `
      width: min(86%, 430px);
      padding: 28px 24px 24px;
      border: 1px solid rgba(103, 232, 249, 0.8);
      border-bottom-color: rgba(244, 114, 182, 0.9);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.72), rgba(2, 6, 23, 0.86)),
        repeating-linear-gradient(0deg, transparent 0 6px, rgba(103, 232, 249, 0.09) 6px 7px);
      box-shadow:
        0 22px 70px rgba(0, 0, 0, 0.46),
        0 0 34px rgba(34, 211, 238, 0.34),
        inset 0 0 30px rgba(14, 165, 233, 0.14);
      text-align: center;
    `;

    const brand = document.createElement("div");
    brand.textContent = "MR. WPLACE";
    brand.style.cssText = `
      color: rgba(224, 250, 255, 0.72);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 3px;
      margin-bottom: 8px;
      text-shadow: 0 0 10px rgba(34, 211, 238, 0.72);
    `;

    const title = document.createElement("div");
    title.textContent = "PIXHELL";
    title.style.cssText = `
      color: #f8fdff;
      font-size: clamp(42px, 9vw, 68px);
      font-weight: 1000;
      line-height: 0.9;
      letter-spacing: 2px;
      text-shadow: 
        1px 1px 0px rgba(14, 165, 233, 0.9),    /* 濃い青で極細の輪郭（右下） */
        -1px -1px 0px rgba(14, 165, 233, 0.9),  /* 濃い青で極細の輪郭（左上） */
        3px 3px 2px rgba(244, 114, 182, 0.8),   /* ピンクをわずかにぼかして硬めの影に */
        5px 5px 4px rgba(34, 211, 238, 0.5);    /* 水色は遠くに引いて薄めの背景に */
    `;

    const actions = document.createElement("div");
    actions.style.cssText = `
      display: grid;
      gap: 10px;
      width: min(260px, 100%);
      margin: 0 auto;
    `;

    const startButton = this.createButton("START", true);
    startButton.addEventListener("click", this.options.onStart);

    const bossModeButton = this.createButton("BOSS", false);
    bossModeButton.addEventListener("click", this.options.onBossMode);

    const exitButton = this.createButton("EXIT", false);
    exitButton.addEventListener("click", this.options.onExit);

    actions.append(startButton, bossModeButton, exitButton);
    panel.append(brand, title, actions);
    root.appendChild(panel);
    document.body.appendChild(root);
    this.root = root;
  };

  destroy = () => {
    this.root?.remove();
    this.root = null;
  };

  private createButton = (label: string, primary: boolean) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = `
      position: relative;
      height: 48px;
      border: 1px solid ${primary ? "rgba(244, 114, 182, 0.98)" : "rgba(103, 232, 249, 0.82)"};
      border-radius: 6px;
      background: ${
        primary
          ? "linear-gradient(180deg, rgba(236, 72, 153, 0.95), rgba(88, 28, 135, 0.95))"
          : "linear-gradient(180deg, rgba(8, 47, 73, 0.94), rgba(15, 23, 42, 0.94))"
      };
      color: #f8fdff;
      box-shadow:
        0 0 0 1px rgba(2, 6, 23, 0.92),
        0 0 22px ${primary ? "rgba(244, 114, 182, 0.42)" : "rgba(34, 211, 238, 0.26)"},
        inset 0 0 16px ${primary ? "rgba(251, 207, 232, 0.22)" : "rgba(34, 211, 238, 0.16)"};
      font-size: 14px;
      font-weight: 1000;
      letter-spacing: 2px;
      text-shadow: 0 0 9px rgba(224, 250, 255, 0.72);
      cursor: pointer;
      transition: filter 0.12s ease, box-shadow 0.12s ease;
    `;
    button.addEventListener("pointerenter", () => {
      button.style.filter = "brightness(1.18)";
    });
    button.addEventListener("pointerleave", () => {
      button.style.filter = "";
    });
    return button;
  };
}
