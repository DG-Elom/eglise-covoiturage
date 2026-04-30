export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PassagerInfo {
  lat: number;
  lng: number;
  adresse: string;
}

export function parseGeoPoint(raw: unknown): GeoPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  // PostGIS GeoJSON format: { type: "Point", coordinates: [lng, lat] }
  if (obj.type === "Point" && Array.isArray(obj.coordinates)) {
    const [lng, lat] = obj.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }

  // Flat format: { lat, lng } or { latitude, longitude }
  const lat = (obj.lat ?? obj.latitude) as number | undefined;
  const lng = (obj.lng ?? obj.longitude) as number | undefined;
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };

  return null;
}

export function buildPickupPrompt(
  depart: GeoPoint,
  departAdresse: string,
  passagers: PassagerInfo[],
  eglise: GeoPoint,
  egliseAdresse: string,
): string {
  const passagersText = passagers
    .map(
      (p, i) =>
        `  - Passager ${i + 1} : lat=${p.lat.toFixed(6)}, lng=${p.lng.toFixed(6)}, adresse="${p.adresse}"`,
    )
    .join("\n");

  return `Tu es un assistant de covoiturage. Propose 1 à 3 points de rendez-vous optimaux pour que le conducteur récupère ses passagers avec un détour minimal.

Données :
- Départ conducteur : lat=${depart.lat.toFixed(6)}, lng=${depart.lng.toFixed(6)}, adresse="${departAdresse}"
- Passagers :
${passagersText}
- Arrivée (église) : lat=${eglise.lat.toFixed(6)}, lng=${eglise.lng.toFixed(6)}, adresse="${egliseAdresse}"

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaire :
{"suggestions":[{"label":"<nom court>","raison":"<1 phrase>","lat":<number>,"lng":<number>}]}`;
}
