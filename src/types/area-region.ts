export interface AreaRegionVertex {
  lng: number;
  lat: number;
}

export interface AreaRegionBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface AreaRegion {
  id: string;
  name: string;
  color: string;
  vertices: AreaRegionVertex[];
  visible: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AreaRegionEditSnapshot {
  regionId: string | null;
  name: string;
  vertices: AreaRegionVertex[];
}

export type AreaNameDisplayMode = "always" | "off";
export type AreaNameStyleMode = "halo" | "color-badge";

export interface AreaDisplayOptions {
  fillOpacityPercent: number;
  nameDisplayMode: AreaNameDisplayMode;
  nameFontSizePx: number;
  nameStyleMode: AreaNameStyleMode;
}
