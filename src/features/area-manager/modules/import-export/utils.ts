import type { AreaRegion } from "@/types/area-region";
import type { AreaRegionGroup } from "@/features/area-manager/types";

const toGeoJsonLinearRing = (vertices: AreaRegion["vertices"]): [number, number][] => {
  const ring = vertices.map((vertex) => [vertex.lng, vertex.lat] as [number, number]);
  if (ring.length < 3) return ring;

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return ring;
};

export const createAreaGeoJson = (
  regions: AreaRegion[],
  groups: AreaRegionGroup[] = [],
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    type: "FeatureCollection",
    features: regions.map((region) => ({
      type: "Feature",
      properties: {
        id: region.id,
        name: region.name,
        color: region.color,
        visible: region.visible,
        createdAt: region.createdAt,
        updatedAt: region.updatedAt,
      },
      geometry: {
        type: "Polygon",
        coordinates: [toGeoJsonLinearRing(region.vertices)],
      },
    })),
  };

  if (groups.length > 0) {
    payload.mrWplaceAreaGroups = groups.map((group) => ({
      id: group.id,
      name: group.name,
      regionIds: [...group.regionIds],
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));
  }

  return payload;
};
