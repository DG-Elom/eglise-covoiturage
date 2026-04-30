export type HeatmapRow = {
  pickup_position: unknown;
  weight: number;
};

type GeoJSONPoint = {
  type: "Point";
  coordinates: [number, number];
};

type HeatmapFeature = {
  type: "Feature";
  geometry: GeoJSONPoint;
  properties: { weight: number };
};

export type HeatmapFeatureCollection = {
  type: "FeatureCollection";
  features: HeatmapFeature[];
};

export function parsePickupPosition(raw: unknown): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type === "Point" && Array.isArray(obj.coordinates)) {
    const [lng, lat] = obj.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return null;
}

export function toGeoJSON(rows: HeatmapRow[]): HeatmapFeatureCollection {
  const features: HeatmapFeature[] = [];
  for (const row of rows) {
    const pos = parsePickupPosition(row.pickup_position);
    if (!pos) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [pos.lng, pos.lat] },
      properties: { weight: row.weight },
    });
  }
  return { type: "FeatureCollection", features };
}
