export interface AreaRegionVertex {
  lng: number;
  lat: number;
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

export type AreaNameDisplayMode = "always" | "off" | "hide-on-zoom-out";

export interface AreaDisplayOptions {
  fillOpacityPercent: number;
  nameClickToGoto: boolean;
  nameDisplayMode: AreaNameDisplayMode;
}
