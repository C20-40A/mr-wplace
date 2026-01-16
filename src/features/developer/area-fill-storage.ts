export interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

let corners: AreaFillCorners = { topLeft: null, bottomRight: null };

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
};
