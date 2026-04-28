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
