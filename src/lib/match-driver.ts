import { haversineKm, type LatLng } from "./distance";

/** Sens d'une demande passager (jamais aller_retour côté demande). */
export type DemandeSens = "aller" | "retour";

/** Sens d'un trajet conducteur. aller_retour couvre aller ET retour. */
export type TrajetSens = "aller" | "retour" | "aller_retour";

export type DemandeMatch = {
  culte_id: string;
  sens: DemandeSens;
  pickup: LatLng;
};

export type TrajetMatch = {
  id: string;
  culte_id: string;
  sens: TrajetSens;
  depart: LatLng | null;
  /** Places restantes (ou capacité). <= 0 => indisponible. */
  places: number;
};

export type DriverMatch<T extends TrajetMatch> = {
  trajet: T;
  distanceKm: number;
};

/** Une position est valide si lat/lng sont des nombres finis dans les bornes terrestres. */
function isValidPosition(p: LatLng | null): p is LatLng {
  if (!p) return false;
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  return p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}

/** Le trajet couvre-t-il le sens demandé ? aller_retour couvre tout, sinon égalité stricte. */
function sensCompatible(trajetSens: TrajetSens, demandeSens: DemandeSens): boolean {
  return trajetSens === "aller_retour" || trajetSens === demandeSens;
}

/**
 * Filtre les trajets compatibles avec une demande puis les trie du plus proche au plus loin.
 * Compatible = même culte_id + sens couvert + position valide + places > 0.
 */
export function compatibleDrivers<T extends TrajetMatch>(
  demande: DemandeMatch,
  trajets: readonly T[],
): DriverMatch<T>[] {
  if (!isValidPosition(demande.pickup)) return [];
  return trajets
    .filter(
      (t) =>
        t.culte_id === demande.culte_id &&
        sensCompatible(t.sens, demande.sens) &&
        t.places > 0 &&
        isValidPosition(t.depart),
    )
    .map((t) => ({
      trajet: t,
      // depart est garanti non-null par le filtre isValidPosition ci-dessus.
      distanceKm: haversineKm(demande.pickup, t.depart as LatLng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Renvoie le conducteur compatible le plus proche, ou null si aucun.
 */
export function nearestCompatibleDriver<T extends TrajetMatch>(
  demande: DemandeMatch,
  trajets: readonly T[],
): DriverMatch<T> | null {
  return compatibleDrivers(demande, trajets)[0] ?? null;
}
