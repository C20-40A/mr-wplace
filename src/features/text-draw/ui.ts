export const createTextInputButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-primary";
  button.style.cssText = "margin: 0.5rem;";
  button.setAttribute("data-wplace-text-draw", "true");
  button.innerHTML = `✏️ TEXT`;
  return button;
};

export const createTextModal = (): {
  show: (onDraw: (text: string, font: string) => Promise<void>) => void;
  hide: () => void;
} => {
  const backdrop = document.createElement("div");
  backdrop.style.cssText = `
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background-color: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  `;

  const title = document.createElement("h3");
  title.textContent = "TEXT";
  title.style.cssText =
    "font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem;";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Enter text...";
  input.className = "input input-bordered w-full";
  input.style.cssText = "width: 100%; margin-bottom: 1rem;";

  const fontSelect = document.createElement("select");
  fontSelect.className = "select select-bordered w-full";
  fontSelect.style.cssText = "width: 100%; margin-bottom: 1rem;";
  fontSelect.innerHTML = `
    <option value="Bytesized">Bytesized (3x4)</option>
    <option value="comic_sans_ms_pixel">Comic Sans MS Pixel (6x10)</option>
    <option value="minikana">🇯🇵 Minikana (4x4)</option>
    <option value="Misaki">🇯🇵 Misaki (8x8)</option>
    <option value="k8x12">🇯🇵 k8x12 (8x12)</option>
  `;

  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText =
    "display: flex; justify-content: flex-end; gap: 0.5rem;";

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.className = "btn";

  const drawButton = document.createElement("button");
  drawButton.innerHTML = "✏️ Draw";
  drawButton.className = "btn btn-primary";

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(drawButton);

  modal.appendChild(title);
  modal.appendChild(input);
  modal.appendChild(fontSelect);
  modal.appendChild(buttonContainer);
  backdrop.appendChild(modal);

  const hide = () => {
    backdrop.remove();
  };

  const show = (onDraw: (text: string, font: string) => Promise<void>) => {
    document.body.appendChild(backdrop);
    input.focus();

    cancelButton.onclick = hide;

    drawButton.onclick = async () => {
      const text = input.value.trim();
      if (!text) return;
      hide();
      await onDraw(text, fontSelect.value);
    };

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        drawButton.click();
      } else if (e.key === "Escape") {
        hide();
      }
    };
  };

  return { show, hide };
};
