const AUTH_INIT_SOURCE = "mr-wplace-auth-init";
const AUTH_ACK_SOURCE = "mr-wplace-auth-init-ack";
const INIT_RETRY_INTERVAL_MS = 250;
const INIT_TIMEOUT_MS = 5000;

export interface DangerousMessageAuth {
  token: string;
  nonce: string;
  ts: number;
}

let token = "";
let initDone = false;
let initPromise: Promise<void> | null = null;
let initResolve: (() => void) | null = null;
let initReject: ((error: Error) => void) | null = null;
let initTimer: ReturnType<typeof setTimeout> | null = null;
let initTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let ackListenerSetup = false;

const generateRandomString = (bytes = 16): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
};

const stopInitTimers = (): void => {
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }
  if (initTimeoutTimer) {
    clearTimeout(initTimeoutTimer);
    initTimeoutTimer = null;
  }
};

const postInit = (): void => {
  if (!token) token = generateRandomString(24);
  window.postMessage(
    {
      source: AUTH_INIT_SOURCE,
      token,
    },
    "*"
  );
};

const setupAckListener = (): void => {
  if (ackListenerSetup) return;
  ackListenerSetup = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.source !== AUTH_ACK_SOURCE) return;
    if (event.data?.token !== token) return;

    initDone = true;
    stopInitTimers();

    if (initResolve) initResolve();

    initPromise = null;
    initResolve = null;
    initReject = null;

    console.log("🧑‍🎨 : Dangerous message auth initialized");
  });
};

export const ensureDangerousMessageAuthReady = async (): Promise<void> => {
  setupAckListener();

  if (initDone) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    initResolve = resolve;
    initReject = reject;

    const retry = () => {
      if (initDone) return;
      postInit();
      initTimer = setTimeout(retry, INIT_RETRY_INTERVAL_MS);
    };

    postInit();
    initTimer = setTimeout(retry, INIT_RETRY_INTERVAL_MS);

    initTimeoutTimer = setTimeout(() => {
      if (initDone) return;

      stopInitTimers();

      const error = new Error("Dangerous message auth init timed out");
      if (initReject) initReject(error);

      initPromise = null;
      initResolve = null;
      initReject = null;
    }, INIT_TIMEOUT_MS);
  });

  return initPromise;
};

export const createDangerousMessageAuth = async (): Promise<DangerousMessageAuth> => {
  await ensureDangerousMessageAuthReady();

  return {
    token,
    nonce: generateRandomString(16),
    ts: Date.now(),
  };
};

export const withDangerousMessageAuth = async <T extends Record<string, unknown>>(
  payload: T
): Promise<T & { auth: DangerousMessageAuth }> => {
  const auth = await createDangerousMessageAuth();
  return {
    ...payload,
    auth,
  };
};
