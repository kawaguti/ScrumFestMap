export const japanGeoData = {
  "type": "FeatureCollection",
  "features": prefectures.map(pref => ({
    "type": "Feature",
    "properties": {
      "id": pref.id,
      "name": pref.name,
      "region": pref.region
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[]]
    }
  }))
};
