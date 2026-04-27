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
