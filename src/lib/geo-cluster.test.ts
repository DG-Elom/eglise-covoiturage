import { describe, it, expect } from "vitest";
import { clusterByDistance } from "./geo-cluster";

describe("clusterByDistance", () => {
  it("regroupe 5 points dans un rayon de 1 km en un seul cluster", () => {
    // Points très proches : quartier de Metz centre (~200m d'écart max)
    const points = [
      { lat: 49.1193, lng: 6.1757 },
      { lat: 49.1197, lng: 6.1760 },
      { lat: 49.1195, lng: 6.1762 },
      { lat: 49.1200, lng: 6.1755 },
      { lat: 49.1190, lng: 6.1758 },
    ];

    const clusters = clusterByDistance(points, 1);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(5);
  });

  it("sépare des points éloignés de plus de 1 km en clusters distincts", () => {
    // Point 1 : Metz centre, Point 2 : 2 km au nord
    const points = [
      { lat: 49.1193, lng: 6.1757 }, // Metz centre
      { lat: 49.1370, lng: 6.1757 }, // ~2 km au nord
    ];

    const clusters = clusterByDistance(points, 1);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toHaveLength(1);
    expect(clusters[1]).toHaveLength(1);
  });

  it("gère un seul point : retourne un cluster d'un seul élément", () => {
    const points = [{ lat: 49.1193, lng: 6.1757 }];

    const clusters = clusterByDistance(points, 1);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(1);
  });

  it("gère un tableau vide : retourne un tableau vide", () => {
    const clusters = clusterByDistance([], 1);

    expect(clusters).toHaveLength(0);
  });

  it("sépare correctement un mix proche + éloigné en 2 clusters", () => {
    // 3 points proches + 2 points loin (~3 km)
    const close = [
      { lat: 49.1193, lng: 6.1757 },
      { lat: 49.1195, lng: 6.1760 },
      { lat: 49.1190, lng: 6.1755 },
    ];
    const far = [
      { lat: 49.1460, lng: 6.1757 }, // ~3 km au nord
      { lat: 49.1465, lng: 6.1760 },
    ];

    const clusters = clusterByDistance([...close, ...far], 1);

    expect(clusters).toHaveLength(2);
    const sizes = clusters.map((c) => c.length).sort((a, b) => a - b);
    expect(sizes).toEqual([2, 3]);
  });

  it("conserve les propriétés originales des points dans les clusters", () => {
    type PointWithId = { lat: number; lng: number; id: string };
    const points: PointWithId[] = [
      { lat: 49.1193, lng: 6.1757, id: "p1" },
      { lat: 49.1195, lng: 6.1760, id: "p2" },
    ];

    const clusters = clusterByDistance(points, 1);

    expect(clusters).toHaveLength(1);
    const ids = clusters[0].map((p) => (p as PointWithId).id).sort();
    expect(ids).toEqual(["p1", "p2"]);
  });
});
