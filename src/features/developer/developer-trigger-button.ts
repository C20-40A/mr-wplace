const applyTriggerButtonStyle = (
  button: HTMLButtonElement,
  isActive: boolean
): void => {
  if (isActive) {
    button.style.opacity = "1";
    button.style.background = "rgba(50, 120, 220, 0.2)";
    button.style.borderColor = "rgba(50, 120, 220, 0.45)";
    button.style.color = "rgba(30, 80, 170, 1)";
    button.dataset.active = "true";
    return;
  }

  button.style.opacity = "0.4";
  button.style.background = "";
  button.style.borderColor = "";
  button.style.color = "";
  button.dataset.active = "false";
};

export const createDeveloperTriggerButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-circle btn-ghost";
  button.title = "Developer Tools";

  // Terminal/Code icon - cool dev vibe
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
      <path fill-rule="evenodd" d="M2.25 6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V6Zm3.97.97a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 0 1-1.06-1.06l1.72-1.72-1.72-1.72a.75.75 0 0 1 0-1.06Zm4.28 4.28a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" clip-rule="evenodd" />
    </svg>
  `;

  button.style.cssText = `opacity: 0.4; transition: opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease;`;

  button.addEventListener("mouseenter", () => {
    if (button.dataset.active === "true") return;
    button.style.opacity = "0.8";
  });
  button.addEventListener("mouseleave", () => {
    if (button.dataset.active === "true") return;
    button.style.opacity = "0.4";
  });

  applyTriggerButtonStyle(button, false);
  return button;
};

export const setDeveloperTriggerButtonActive = (
  button: HTMLButtonElement,
  isActive: boolean
): void => {
  applyTriggerButtonStyle(button, isActive);
};
