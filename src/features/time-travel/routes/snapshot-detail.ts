import { TimeTravelRouter } from "../router";
import { t } from "../../../i18n/manager";

export class SnapshotDetailRoute {
  private currentBlob?: Blob;

  render(container: HTMLElement, router: TimeTravelRouter): void {
    const selectedSnapshot = (router as any).selectedSnapshot;
    
    if (!selectedSnapshot) {
      container.innerHTML = `<div class="text-sm text-red-500 text-center p-4">No snapshot selected</div>`;
      return;
    }

    container.innerHTML = t`
      <div class="flex flex-col items-center justify-center mb-4">
        <div class="flex items-center justify-center" style="max-height: 70vh; max-width: 90vw;">
          <img id="wps-snapshot-image" src="" alt="Snapshot" class="" style="image-rendering: pixelated; min-width: 50vw; max-width: 90vw; max-height: 70vh; object-fit: contain; aspect-ratio: auto;">
        </div>
      </div>
      
      <div class="flex gap-2 justify-center">
        <button id="wps-download-snapshot-btn" class="btn btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path fill-rule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06L11.25 14.69V3a.75.75 0 01.75-.75z" clip-rule="evenodd" />
            <path fill-rule="evenodd" d="M6.75 15.75a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
          </svg>
          ${"download"}
        </button>
      </div>
    `;

    this.setupEvents(container);
    this.loadSnapshot(selectedSnapshot.fullKey);
  }

  private setupEvents(container: HTMLElement): void {
    container
      .querySelector("#wps-download-snapshot-btn")
      ?.addEventListener("click", () => {
        this.downloadSnapshot();
      });
  }

  private async loadSnapshot(fullKey: string): Promise<void> {
    try {
      const result = await chrome.storage.local.get(fullKey);
      if (!result[fullKey]) throw new Error("Snapshot not found");

      const uint8Array = new Uint8Array(result[fullKey]);
      this.currentBlob = new Blob([uint8Array], { type: "image/png" });
      
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(this.currentBlob!);
      });

      const img = document.getElementById("wps-snapshot-image") as HTMLImageElement;
      if (img) {
        img.src = dataUrl;
      }
    } catch (error) {
      console.error("Failed to load snapshot:", error);
      const img = document.getElementById("wps-snapshot-image") as HTMLImageElement;
      if (img) {
        img.alt = "Failed to load snapshot";
      }
    }
  }

  private downloadSnapshot(): void {
    if (!this.currentBlob) return;

    const url = URL.createObjectURL(this.currentBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
