/**
 * Debug utility: Import image as legacy Chrome Storage format
 * For testing migration. Run from page console.
 *
 * Usage: window.debugLegacyImport()
 * inject -> postMessage -> content script -> chrome.storage
 */

export const debugLegacyImport = (): void => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    // Send to content script
    window.postMessage({
      source: "mr-wplace-debug-legacy-import",
      dataUrl,
      title: file.name.replace(/\.[^.]+$/, ""),
    }, "*");

    input.remove();
  };

  document.body.appendChild(input);
  input.click();
};

if (typeof window !== "undefined") {
  (window as any).debugLegacyImport = debugLegacyImport;
}
