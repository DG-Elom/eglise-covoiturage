import { describe, it, expect } from "vitest";
import { toGeoJSON, parsePickupPosition, type HeatmapRow } from "./_logic";

describe("parsePickupPosition", () => {
  it("parse le format GeoJSON PostGIS Point", () => {
    const result = parsePickupPosition({ type: "Point", coordinates: [6.176, 49.147] });
    expect(result).toEqual({ lat: 49.147, lng: 6.176 });
  });

  it("retourne null pour un format invalide", () => {
    expect(parsePickupPosition(null)).toBeNull();
    expect(parsePickupPosition({ foo: "bar" })).toBeNull();
    expect(parsePickupPosition("string")).toBeNull();
  });

  it("retourne null pour un Point sans coordonnées", () => {
    expect(parsePickupPosition({ type: "Point" })).toBeNull();
  });
});

describe("toGeoJSON", () => {
  const rows: HeatmapRow[] = [
    {
      pickup_position: { type: "Point", coordinates: [6.176, 49.147] },
      weight: 5,
    },
    {
      pickup_position: { type: "Point", coordinates: [6.18, 49.15] },
      weight: 2,
    },
  ];

  it("retourne un FeatureCollection valide", () => {
    const result = toGeoJSON(rows);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(2);
  });

  it("chaque feature est un GeoJSON Point", () => {
    const result = toGeoJSON(rows);
    const first = result.features[0];
    expect(first.type).toBe("Feature");
    expect(first.geometry.type).toBe("Point");
    expect(first.geometry.coordinates).toEqual([6.176, 49.147]);
  });

  it("inclut le weight dans properties", () => {
    const result = toGeoJSON(rows);
    expect(result.features[0].properties.weight).toBe(5);
    expect(result.features[1].properties.weight).toBe(2);
  });

  it("ignore les lignes avec position invalide", () => {
    const rowsWithInvalid: HeatmapRow[] = [
      ...rows,
      { pickup_position: null, weight: 3 },
    ];
    const result = toGeoJSON(rowsWithInvalid);
    expect(result.features).toHaveLength(2);
  });

  it("retourne un FeatureCollection vide si aucune donnée", () => {
    const result = toGeoJSON([]);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(0);
  });
});
