export const createAutoColorSpoitButton = (
  enabled: boolean
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-circle btn-ghost";
  button.title = "Toggle auto color spoit";

  // Eyedropper icon SVG
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
      <!-- Eyedropper icon -->
      <path d="M17.66 3.87l2.83 2.83c.39.39.39 1.02 0 1.41l-9.9 9.9-3.54-.7-.7-3.54 9.9-9.9c.39-.39 1.02-.39 1.41 0zM7.75 17.66l-1.41 1.41c-.78.78-2.05.78-2.83 0s-.78-2.05 0-2.83l1.41-1.41 2.83 2.83z"/>
      <path d="M4.92 19.07c.39.39 1.02.39 1.41 0l1.42-1.42-2.83-2.83-1.42 1.42c-.39.39-.39 1.02 0 1.41l1.42 1.42z" opacity="0.6"/>
    </svg>
  `;

  // ON/OFF状態で色を変更
  if (enabled) {
    button.classList.add("text-primary");
  } else {
    button.classList.add("text-base-content");
    button.style.opacity = "0.5";
  }

  return button;
};
