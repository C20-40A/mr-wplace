const AUTH_ACK_SOURCE = "mr-wplace-auth-init-ack";
const MAX_CLOCK_SKEW_MS = 15_000;
const NONCE_RETENTION_MS = 120_000;

interface IncomingDangerousAuth {
  token?: unknown;
  nonce?: unknown;
  ts?: unknown;
}

let sessionToken: string | null = null;
const usedNonces = new Map<string, number>();

const cleanupNonces = (now: number): void => {
  for (const [nonce, usedAt] of usedNonces.entries()) {
    if (now - usedAt > NONCE_RETENTION_MS) usedNonces.delete(nonce);
  }
};

export const handleDangerousAuthInit = (data: { token?: unknown }): void => {
  if (typeof data?.token !== "string" || data.token.length < 16) {
    console.warn("🧑‍🎨 : Rejected invalid dangerous auth init message");
    return;
  }

  // Allow token rotation by content script during page lifetime.
  if (sessionToken !== data.token) {
    sessionToken = data.token;
    usedNonces.clear();
    console.log("🧑‍🎨 : Dangerous message auth token registered");
  }

  window.postMessage(
    {
      source: AUTH_ACK_SOURCE,
      token: sessionToken,
    },
    "*"
  );
};

export const isDangerousMessageAuthorized = (payload: {
  auth?: IncomingDangerousAuth;
}): boolean => {
  if (!sessionToken) {
    console.warn("🧑‍🎨 : Rejected dangerous command (auth not initialized)");
    return false;
  }

  const auth = payload?.auth;
  if (!auth) return false;
  if (typeof auth.token !== "string") return false;
  if (typeof auth.nonce !== "string") return false;
  if (typeof auth.ts !== "number") return false;
  if (auth.token !== sessionToken) return false;

  const now = Date.now();
  if (!Number.isFinite(auth.ts) || Math.abs(now - auth.ts) > MAX_CLOCK_SKEW_MS) {
    return false;
  }

  cleanupNonces(now);
  if (usedNonces.has(auth.nonce)) return false;

  usedNonces.set(auth.nonce, now);
  return true;
};
