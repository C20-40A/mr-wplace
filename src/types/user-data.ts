export interface WPlaceUserData {
  allianceId: number;
  allianceRole: string;
  banned: boolean;
  charges: {
    cooldownMs: number;
    count: number;
    max: number;
  };
  country: string;
  discord: string;
  droplets: number;
  equippedFlag: number;
  experiments: Record<string, any>;
  extraColorsBitmap: number;
  favoriteLocations: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
  }>;
  flagsBitmap: string;
  id: number;
  isCustomer: boolean;
  level: number;
  maxFavoriteLocations: number;
  name: string;
  needsPhoneVerification: boolean;
  picture: string;
  pixelsPainted: number;
  showLastPixel: boolean;
  timeoutUntil: string;
}
