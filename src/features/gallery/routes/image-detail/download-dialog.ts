import { t } from "@/i18n/manager";

export type DownloadFormat = "png" | "wplace";

export const showDownloadFormatDialog = (
  hasDrawPosition: boolean
): Promise<DownloadFormat | null> => {
  return new Promise((resolve) => {
    const modal = document.createElement("dialog");
    modal.className = "modal modal-open";

    modal.innerHTML = `
      <div class="modal-box" style="max-width: 28rem;">
        <h3 class="font-bold text-lg mb-3">${t("download")}</h3>
        <p class="text-sm mb-4">${t("share_description")}</p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button id="download-png-btn" class="btn btn-accent">${t("export_png")}</button>
          ${
            hasDrawPosition
              ? `<button id="download-wplace-btn" class="btn btn-primary">.wplace</button>`
              : ""
          }
          <button id="download-cancel-btn" class="btn btn-ghost">${t("close")}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button aria-label="${t("close")}">${t("close")}</button>
      </form>
    `;

    document.body.appendChild(modal);

    let resolved = false;

    const finish = (value: DownloadFormat | null) => {
      if (resolved) return;
      resolved = true;
      modal.close();
      resolve(value);
    };

    modal.querySelector("#download-png-btn")?.addEventListener("click", () => {
      finish("png");
    });
    modal.querySelector("#download-wplace-btn")?.addEventListener("click", () => {
      finish("wplace");
    });
    modal
      .querySelector("#download-cancel-btn")
      ?.addEventListener("click", () => finish(null));

    modal.addEventListener("close", () => {
      modal.remove();
      if (!resolved) resolve(null);
    });

    modal.showModal();
  });
};
