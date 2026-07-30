import { t } from "../i18n/manager";

interface ImageDropzoneOptions {
  onFileSelected: (file: File) => void;
  acceptedTypes?: string;
  autoHide?: boolean; // ファイル選択時に自動非表示（デフォルト: false）
}

/**
 * ドラッグ&ドロップによる画像ファイル選択コンポーネント
 * clickでファイル選択ダイアログも開く
 */
export class ImageDropzone {
  private container: HTMLElement;
  private dropzoneElement!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private options: ImageDropzoneOptions & { autoHide: boolean };
  private pasteHandler: ((event: ClipboardEvent) => void) | null = null;

  constructor(container: HTMLElement, options: ImageDropzoneOptions) {
    this.container = container;
    this.options = {
      onFileSelected: options.onFileSelected,
      acceptedTypes: options.acceptedTypes,
      autoHide: options.autoHide ?? false,
    };

    this.init();
  }

  private init(): void {
    this.createDropzoneUI();
    this.setupEventHandlers();
  }

  private createDropzoneUI(): void {
    this.container.innerHTML = `
      <div id="image-dropzone" class="flex items-center justify-center h-full text-center cursor-pointer">
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 mx-auto mb-4 text-gray-400">
            <path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06L12.75 4.81V15a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25A1.5 1.5 0 005.25 21h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
          </svg>
          <p class="text-gray-600 mb-2">${t`${"drag_drop_or_click"}`}</p>
          <input type="file" id="dropzone-file-input" class="hidden">
        </div>
      </div>
    `;

    this.dropzoneElement = this.container.querySelector("#image-dropzone")!;
    this.fileInput = this.container.querySelector("#dropzone-file-input")! as HTMLInputElement;
    if (this.options.acceptedTypes)
      this.fileInput.accept = this.options.acceptedTypes;
  }

  private setupEventHandlers(): void {
    // Click to open file dialog
    this.dropzoneElement.addEventListener("click", () => this.fileInput.click());

    // File input change
    this.fileInput.addEventListener("change", (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        this.handleFileSelection(files[0]);
      }
    });

    // Drag and drop handlers
    this.dropzoneElement.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.setDragState(true);
    });

    this.dropzoneElement.addEventListener("dragleave", () => {
      this.setDragState(false);
    });

    this.dropzoneElement.addEventListener("drop", (e) => {
      e.preventDefault();
      this.setDragState(false);

      const files = (e as DragEvent).dataTransfer?.files;
      if (files && files[0]) {
        this.handleFileSelection(files[0]);
      }
    });

    // Paste an image from the clipboard (for example, with Ctrl+V).
    this.pasteHandler = (event: ClipboardEvent) => {
      if (!this.container.isConnected || this.container.style.display === "none") {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const clipboardItems = event.clipboardData?.items;
      const imageItem = clipboardItems
        ? Array.from(clipboardItems).find(
            (item) => item.kind === "file" && item.type.startsWith("image/"),
          )
        : undefined;
      const clipboardFile =
        imageItem?.getAsFile() ??
        Array.from(event.clipboardData?.files ?? []).find((file) =>
          file.type.startsWith("image/"),
        );
      if (!clipboardFile) return;

      event.preventDefault();
      this.handleFileSelection(this.createPastedImageFile(clipboardFile));
    };
    this.container.ownerDocument.addEventListener("paste", this.pasteHandler);
  }

  private createPastedImageFile(file: File): File {
    if (file.name) return file;

    const extension = file.type.split("/")[1]?.split("+")[0] || "png";
    return new File([file], `pasted-image.${extension}`, {
      type: file.type,
      lastModified: Date.now(),
    });
  }

  private handleFileSelection(file: File): void {
    this.showSelectedFile(file);
    this.options.onFileSelected(file);
    if (this.options.autoHide) {
      this.hide();
    }
  }

  private showSelectedFile(file: File): void {
    if (!file.type.startsWith("image/")) {
      this.dropzoneElement.innerHTML = `
        <div class="text-center">
          <p class="text-sm text-gray-600">${file.name}</p>
          <p class="text-xs text-gray-500 mt-1">クリックで変更</p>
        </div>
      `;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.dropzoneElement.innerHTML = `
        <div class="text-center">
          <img src="${e.target?.result}" class="max-w-full max-h-32 mx-auto mb-2 rounded" alt="Selected image">
          <p class="text-sm text-gray-600">${file.name}</p>
          <p class="text-xs text-gray-500 mt-1">クリックで変更</p>
        </div>
      `;
    };
    reader.readAsDataURL(file);
  }

  private setDragState(isDragging: boolean): void {
    if (isDragging) {
      this.container.style.borderColor = "#3b82f6";
      this.container.style.backgroundColor = "#eff6ff";
    } else {
      this.container.style.borderColor = "#d1d5db";
      this.container.style.backgroundColor = "";
    }
  }

  destroy(): void {
    if (this.pasteHandler) {
      this.container.ownerDocument.removeEventListener("paste", this.pasteHandler);
      this.pasteHandler = null;
    }

    // Event listeners on the dropzone are removed with its DOM nodes.
    this.container.innerHTML = "";
  }

  hide(): void {
    this.container.style.display = "none";
  }

  show(): void {
    this.container.style.display = "";
  }
}
