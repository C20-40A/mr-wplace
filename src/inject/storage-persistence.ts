export const requestPersistentStorage = async (): Promise<boolean> => {
  if (!navigator.storage?.persist) return false;

  try {
    if (await navigator.storage.persisted()) return true;

    const granted = await navigator.storage.persist();
    console.log(
      `🧑‍🎨 : Storage persistence ${granted ? "granted" : "denied"}`
    );
    return granted;
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to request persistent storage:", error);
    return false;
  }
};
