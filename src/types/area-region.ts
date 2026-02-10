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
