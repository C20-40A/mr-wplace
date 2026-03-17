export const CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED = true;

export const logCustomGeoJsonDisabled = (feature: string): void => {
  console.log(`🧑‍🎨 : ${feature} disabled because custom GeoJSON layers are temporarily off`);
};
