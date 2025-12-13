/**
 * Debug utility: Import image as legacy Chrome Storage format
 * For testing migration. Run from inject context (page console).
 *
 * Usage in console:
 *   window.debugLegacyImport()
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

    const timestamp = Date.now();
    const key = `gallery_${timestamp}`;

    // Save to Chrome Storage in legacy format
    const item = {
      key,
      timestamp,
      dataUrl,
      title: "",
      drawPosition: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
      drawEnabled: true,
      layerOrder: 0,
    };

    // Access chrome.storage via window (inject context)
    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ [key]: item }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    // Clear migration version to trigger migration
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove("mr-wplace-migration-version", resolve);
    });

    console.log(`🧑‍🎨 [DEBUG] Saved legacy item: ${key}`);
    console.log("🧑‍🎨 [DEBUG] Reload page to trigger migration");
    alert(`Saved as legacy format: ${key}\nReload page to test migration.`);

    input.remove();
  };

  document.body.appendChild(input);
  input.click();
};
