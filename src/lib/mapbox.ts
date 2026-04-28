export type GeocodeResult = {
  id: string;
  address: string;
  lat: number;
  lng: number;
};

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&language=fr&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const f = data.features?.[0];
  if (!f) return null;
  return { id: f.id, address: f.place_name, lat, lng };
}

export type RouteResult = {
  geometry: { type: "LineString"; coordinates: [number, number][] };
  durationSec: number;
  distanceKm: number;
};

export async function getDrivingRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<RouteResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?access_token=${token}&geometries=geojson&overview=full&language=fr`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;

  return {
    geometry: route.geometry as { type: "LineString"; coordinates: [number, number][] },
    durationSec: route.duration as number,
    distanceKm: (route.distance as number) / 1000,
  };
}

export async function getDrivingDuration(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<number | null> {
  const result = await getDrivingRoute(origin, dest);
  return result ? result.durationSec : null;
}

export type LegInfo = {
  durationSec: number;
  distanceKm: number;
};

export type OptimizedRoute = {
  // Order in which the input waypoints should be visited (mid-stops only,
  // origin and destination are fixed at index 0 and last).
  // Each entry is the original waypoint index from the input array.
  orderedIndices: number[];
  geometry: { type: "LineString"; coordinates: [number, number][] };
  legs: LegInfo[]; // one per segment between consecutive ordered waypoints
  totalDurationSec: number;
  totalDistanceKm: number;
};

/**
 * Calls Mapbox Optimization API v1 to compute the optimal pickup order
 * between conducteur (origin), N passengers (mid-stops), and église (destination).
 *
 * waypoints: [origin, mid1, mid2, ..., destination] — at least 2.
 * The first stays as start, the last stays as end. Mids are reordered.
 */
export async function getOptimizedRoute(
  waypoints: { lat: number; lng: number }[],
): Promise<OptimizedRoute | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || waypoints.length < 2) return null;
  if (waypoints.length > 12) return null; // Mapbox limit

  const coords = waypoints.map((w) => `${w.lng},${w.lat}`).join(";");
  const url =
    `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coords}` +
    `?access_token=${token}` +
    `&geometries=geojson&overview=full&source=first&destination=last&roundtrip=false`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    code?: string;
    trips?: {
      duration: number;
      distance: number;
      geometry: { type: string; coordinates: [number, number][] };
      legs: { duration: number; distance: number }[];
    }[];
    waypoints?: { waypoint_index: number }[];
  };
  if (data.code !== "Ok" || !data.trips || data.trips.length === 0) return null;

  const trip = data.trips[0];
  // waypoints[i].waypoint_index gives the order: original input index i
  // is visited at position waypoint_index in the optimized trip.
  // We want orderedIndices = list of original indices in visitation order.
  const orderedIndices = (data.waypoints ?? [])
    .map((w, originalIdx) => ({ originalIdx, pos: w.waypoint_index }))
    .sort((a, b) => a.pos - b.pos)
    .map((w) => w.originalIdx);

  return {
    orderedIndices,
    geometry: {
      type: "LineString",
      coordinates: trip.geometry.coordinates,
    },
    legs: trip.legs.map((l) => ({
      durationSec: l.duration,
      distanceKm: l.distance / 1000,
    })),
    totalDurationSec: trip.duration,
    totalDistanceKm: trip.distance / 1000,
  };
}

export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || query.trim().length < 3) return [];

  const params = new URLSearchParams({
    access_token: token,
    autocomplete: "true",
    limit: "5",
    language: "fr",
  });

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query,
  )}.json?${params}`;

  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.features ?? []).map(
    (f: { id: string; place_name: string; center: [number, number] }) => ({
      id: f.id,
      address: f.place_name,
      lng: f.center[0],
      lat: f.center[1],
    }),
  );
}
