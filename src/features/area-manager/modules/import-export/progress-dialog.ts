import { t } from "@/i18n/manager";

interface ProgressDialogController {
  update: (percent: number, message?: string) => void;
  close: () => void;
}

export const showProgressDialog = (title: string): ProgressDialogController => {
  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 24rem;">
      <h3 class="font-bold text-lg mb-4">${title}</h3>
      <div id="progress-message" style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;"></div>
      <progress id="progress-bar" class="progress progress-primary w-full" value="0" max="100"></progress>
      <div id="progress-percent" style="text-align: center; margin-top: 0.5rem; font-size: 0.875rem; color: oklch(var(--bc) / 0.6);">0%</div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  const progressBar = modal.querySelector("#progress-bar") as HTMLProgressElement;
  const progressPercent = modal.querySelector("#progress-percent") as HTMLDivElement;
  const progressMessage = modal.querySelector("#progress-message") as HTMLDivElement;

  let pendingPercent = 0;
  let pendingMessage = "";
  let rafId: number | null = null;
  let lastRounded = -1;
  let lastMessage = "";

  const flush = () => {
    rafId = null;
    const rounded = Math.round(pendingPercent);
    if (rounded !== lastRounded) {
      progressBar.value = pendingPercent;
      progressPercent.textContent = `${rounded}%`;
      lastRounded = rounded;
    }
    if (pendingMessage && pendingMessage !== lastMessage) {
      progressMessage.textContent = pendingMessage;
      lastMessage = pendingMessage;
    }
  };

  return {
    update: (percent: number, message?: string) => {
      pendingPercent = Math.max(0, Math.min(100, percent));
      if (message) pendingMessage = message;
      if (rafId === null) rafId = requestAnimationFrame(flush);
    },
    close: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      modal.close();
      modal.remove();
    },
  };
};
