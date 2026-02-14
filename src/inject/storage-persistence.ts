export const requestPersistentStorage = async (): Promise<boolean> => {
  if (typeof navigator === "undefined") return false;
  if (!navigator.storage?.persist) {
    console.log("🧑‍🎨 : Persistent storage API is not supported");
    return false;
  }

  try {
    const alreadyPersisted = await navigator.storage.persisted?.();
    if (alreadyPersisted) {
      console.log("🧑‍🎨 : Persistent storage is already enabled");
      return true;
    }

    const granted = await navigator.storage.persist();
    console.log(
      `🧑‍🎨 : Persistent storage request ${granted ? "granted" : "not granted"}`
    );
    return granted;
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to request persistent storage:", error);
    return false;
  }
};
