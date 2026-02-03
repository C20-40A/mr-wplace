export interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

export type FillPattern = "linear" | "spiralPingPong";

let corners: AreaFillCorners = { topLeft: null, bottomRight: null };
let templateOnlyMode = false;
let fillPattern: FillPattern = "spiralPingPong";

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
};
