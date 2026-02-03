export interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

export type FillPattern = "linear" | "spiralPingPong";

let corners: AreaFillCorners = { topLeft: null, bottomRight: null };
let templateOnlyMode = false;
let fillPattern: FillPattern = "spiralPingPong";

const TMPL_UNLOCK_KEY = "mr-wplace-tmpl-unlocked";

export const AreaFillStorage = {
  getCorners: () => corners,

  setTopLeft: (lat: number, lng: number) => {
    corners = { ...corners, topLeft: { lat, lng } };
  },

  setBottomRight: (lat: number, lng: number) => {
    corners = { ...corners, bottomRight: { lat, lng } };
  },

  clear: () => {
    corners = { topLeft: null, bottomRight: null };
  },

  getTemplateOnlyMode: () => templateOnlyMode,

  setTemplateOnlyMode: (enabled: boolean) => {
    templateOnlyMode = enabled;
  },

  getFillPattern: (): FillPattern => fillPattern,

  setFillPattern: (pattern: FillPattern) => {
    fillPattern = pattern;
  },

  getTmplUnlocked: (): boolean => {
    try {
      return localStorage.getItem(TMPL_UNLOCK_KEY) === "1";
    } catch {
      return false;
    }
  },

  setTmplUnlocked: (unlocked: boolean) => {
    try {
      if (unlocked) localStorage.setItem(TMPL_UNLOCK_KEY, "1");
      else localStorage.removeItem(TMPL_UNLOCK_KEY);
    } catch {}
  },
};
