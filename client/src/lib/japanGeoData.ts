import { prefectures } from "./prefectures";
import { prefecturePaths } from "./prefecturePaths";

export interface GeoFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    region: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

export interface GeoJSON {
  type: "FeatureCollection";
  features: GeoFeature[];
}

export const japanGeoData = {
  type: "FeatureCollection",
  features: prefectures.map(pref => ({
    type: "Feature",
    properties: {
      id: pref.id,
      name: pref.name,
      region: pref.region
    },
    geometry: {
      type: "Polygon",
      coordinates: [prefecturePaths[pref.id].split(" ")
        .filter((_, i) => i > 0)
        .map(coord => coord.split(",").map(Number))]
    }
  }))
} as GeoJSON;
