import { TimeTravelRouter } from "../router";
import { t } from "../../../i18n/manager";
import { ImageDropzone } from "../../../components/image-dropzone";
import { TileSnapshot } from "../utils/tile-snapshot";
import { Toast } from "../../../components/toast";

export class ImportSnapshotRoute {
  private imageDropzone?: ImageDropzone;
  private selectedFile?: File;

  render(container: HTMLElement, router: TimeTravelRouter): void {
    // 現在時刻をISO形式でデフォルト設定
    const now = new Date();
    const defaultDatetime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

    container.innerHTML = t`
      <div class="p-4" style="display: flex; flex-direction: column; gap: 16px;">
        <div class="border-2 border-dashed border-gray-300 rounded">
          <div id="import-dropzone" style="max-height: 30vh; overflow: auto; padding: 1.5rem"></div>
        </div>
        
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">タイル座標 X</label>
            <input type="number" id="tile-x-input" class="input input-bordered w-full" placeholder="例: 520">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">タイル座標 Y</label>
            <input type="number" id="tile-y-input" class="input input-bordered w-full" placeholder="例: 218">
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">時刻</label>
          <input type="datetime-local" id="datetime-input" class="input input-bordered w-full" value="${defaultDatetime}">
        </div>
        
        <div class="flex justify-end gap-2">
          <button id="import-execute-btn" class="btn btn-primary" disabled>
            ${"import"}
          </button>
        </div>
      </div>
    `;

    this.setupDropzone(container);
    this.setupEvents(container, router);
  }

  private setupDropzone(container: HTMLElement): void {
    const dropzoneContainer = container.querySelector("#import-dropzone")!;
    this.imageDropzone = new ImageDropzone(dropzoneContainer as HTMLElement, {
      onFileSelected: (file) => {
        this.selectedFile = file;
        this.parseFilenameCoordinates(file.name);
        this.updateImportButton();
      },
      autoHide: false,
    });
  }

  private parseFilenameCoordinates(filename: string): void {
    // 対応形式: 1791-908.png, 1791-908-1758516204724.png, 1791-908-1758516204724.snapshot.png
    const match = filename.match(
      /^(\d+)-(\d+)(?:-(\d+))?(?:\.snapshot)?\.[^.]+$/
    );
    if (match) {
      const tileX = match[1];
      const tileY = match[2];
      const timestamp = match[3]; // オプショナル

      (document.querySelector("#tile-x-input") as HTMLInputElement).value =
        tileX;
      (document.querySelector("#tile-y-input") as HTMLInputElement).value =
        tileY;

      // timestampがある場合はdatetimeフィールドにset
      if (timestamp) {
        const date = new Date(parseInt(timestamp));
        const datetimeValue = new Date(
          date.getTime() - date.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 16);
        (document.querySelector("#datetime-input") as HTMLInputElement).value =
          datetimeValue;
      }

      this.updateImportButton();
    }
  }

  private setupEvents(container: HTMLElement, router: TimeTravelRouter): void {
    container
      .querySelector("#import-execute-btn")
      ?.addEventListener("click", async () => {
        await this.handleImport(router);
      });

    // 入力値変更時にボタン状態更新
    ["tile-x-input", "tile-y-input"].forEach((id) => {
      container.querySelector(`#${id}`)?.addEventListener("input", () => {
        this.updateImportButton();
      });
    });
  }

  private updateImportButton(): void {
    const btn = document.querySelector(
      "#import-execute-btn"
    ) as HTMLButtonElement;
    const tileX = (document.querySelector("#tile-x-input") as HTMLInputElement)
      ?.value;
    const tileY = (document.querySelector("#tile-y-input") as HTMLInputElement)
      ?.value;

    btn.disabled = !this.selectedFile || !tileX || !tileY;
  }

  private async handleImport(router: TimeTravelRouter): Promise<void> {
    if (!this.selectedFile) throw new Error("No file selected");

    const tileX = parseInt(
      (document.querySelector("#tile-x-input") as HTMLInputElement).value
    );
    const tileY = parseInt(
      (document.querySelector("#tile-y-input") as HTMLInputElement).value
    );
    const datetimeValue = (
      document.querySelector("#datetime-input") as HTMLInputElement
    ).value;
    const timestamp = new Date(datetimeValue).getTime();

    if (isNaN(tileX) || isNaN(tileY) || isNaN(timestamp)) {
      throw new Error("Invalid numeric values");
    }

    const tileSnapshot = new TileSnapshot();
    await tileSnapshot.importSnapshot(
      this.selectedFile,
      tileX,
      tileY,
      timestamp
    );

    Toast.success("インポートが完了しました");
    router.navigate("tile-list");
  }
}
