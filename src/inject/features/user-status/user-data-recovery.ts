import { handleUserStatusUpdate } from "@/inject/handlers/user-status-handler";
import { statusManagerSingleton } from "./status-manager";
import type { WplaceUserData } from "@/inject/types";

const USER_DATA_URL = "https://backend.wplace.live/me";
const STARTUP_RECOVERY_DELAY_MS = 1500;
const RECOVERY_COOLDOWN_MS = 15000;

let recoveryPromise: Promise<WplaceUserData | null> | null = null;
let startupRecoveryScheduled = false;
let lastRecoveryAttemptAt = 0;

const getCurrentUserData = (): WplaceUserData | null =>
  statusManagerSingleton.getCurrentUserData() ?? null;

const getNativeFetch = (): typeof window.fetch | null => {
  if (window.mrWplaceOriginalFetch) return window.mrWplaceOriginalFetch;
  if (window.fetch) return window.fetch.bind(window);
  return null;
};

const fetchUserDataFallback = async (
  reason: string,
): Promise<WplaceUserData | null> => {
  const nativeFetch = getNativeFetch();
  if (!nativeFetch) {
    console.warn("🧑‍🎨: User data fallback skipped (fetch unavailable)");
    return null;
  }

  try {
    console.log(`🧑‍🎨: Recovering user data via /me fallback (${reason})`);
    const response = await nativeFetch(USER_DATA_URL, {
      credentials: "include",
    });

    if (!response.ok) {
      console.warn(
        `🧑‍🎨: User data fallback failed with status ${response.status}`,
      );
      return null;
    }

    const userData = (await response.json()) as WplaceUserData;
    handleUserStatusUpdate(userData);
    return getCurrentUserData() ?? userData;
  } catch (error) {
    console.warn("🧑‍🎨: User data fallback request failed:", error);
    return null;
  }
};

export const ensureUserDataAvailable = async (
  reason = "unknown",
): Promise<WplaceUserData | null> => {
  const currentUserData = getCurrentUserData();
  if (currentUserData) return currentUserData;

  if (recoveryPromise) return recoveryPromise;

  const now = Date.now();
  if (now - lastRecoveryAttemptAt < RECOVERY_COOLDOWN_MS) return null;

  lastRecoveryAttemptAt = now;
  recoveryPromise = fetchUserDataFallback(reason).finally(() => {
    recoveryPromise = null;
  });

  return recoveryPromise;
};

export const scheduleStartupUserDataRecovery = (): void => {
  if (startupRecoveryScheduled) return;
  startupRecoveryScheduled = true;

  window.setTimeout(() => {
    ensureUserDataAvailable("startup")
      .then((userData) => {
        if (userData) {
          console.log("🧑‍🎨: Startup user data recovery completed");
        }
      })
      .catch((error) => {
        console.warn("🧑‍🎨: Startup user data recovery failed:", error);
      });
  }, STARTUP_RECOVERY_DELAY_MS);
};
