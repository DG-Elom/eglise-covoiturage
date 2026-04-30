/**
 * Clustering géographique par distance (Single-linkage, O(n²)).
 * Suffisant pour les volumes attendus (< 100 points par appel).
 *
 * @param points  Tableau de points quelconques portant au moins { lat, lng }.
 * @param radiusKm  Rayon de regroupement en kilomètres.
 * @returns  Tableau de clusters ; chaque cluster est un tableau de points originaux.
 */

export type GeoPoint = {
  lat: number;
  lng: number;
};

/**
 * Distance haversine entre deux points (en km).
 * Précision suffisante pour des rayons < 50 km.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.asin(Math.sqrt(chord));
}

export function clusterByDistance<T extends GeoPoint>(
  points: T[],
  radiusKm: number,
): T[][] {
  if (points.length === 0) return [];

  const clusterOf = new Array<number>(points.length).fill(-1);
  let nextCluster = 0;

  for (let i = 0; i < points.length; i++) {
    if (clusterOf[i] !== -1) continue;

    clusterOf[i] = nextCluster;

    for (let j = i + 1; j < points.length; j++) {
      if (clusterOf[j] !== -1) continue;
      if (haversineKm(points[i], points[j]) <= radiusKm) {
        clusterOf[j] = nextCluster;
      }
    }

    nextCluster++;
  }

  // Propager l'appartenance de cluster (single-linkage : si A-B et B-C, A-B-C même cluster)
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (clusterOf[i] !== clusterOf[j] && haversineKm(points[i], points[j]) <= radiusKm) {
          const keep = Math.min(clusterOf[i], clusterOf[j]);
          clusterOf[i] = keep;
          clusterOf[j] = keep;
          changed = true;
        }
      }
    }
  }

  // Rassembler
  const map = new Map<number, T[]>();
  for (let i = 0; i < points.length; i++) {
    const c = clusterOf[i];
    if (!map.has(c)) map.set(c, []);
    map.get(c)!.push(points[i]);
  }

  return Array.from(map.values());
}
