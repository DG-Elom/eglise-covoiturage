export function roundCoords(
  lat: number,
  lng: number,
  precision = 3,
): { lat: number; lng: number } {
  const factor = Math.pow(10, precision);
  return {
    lat: Math.round(lat * factor) / factor,
    lng: Math.round(lng * factor) / factor,
  };
}
