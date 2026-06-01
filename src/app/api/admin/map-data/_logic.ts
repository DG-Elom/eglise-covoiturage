import { haversineKm, type LatLng } from "@/lib/distance";

export type GeoPoint = LatLng;

export type DemandeSens = "aller" | "retour";
export type TrajetSens = "aller" | "retour" | "aller_retour";

/** Profil minimal embarqué dans les jointures. */
export type MiniProfil = {
  id: string;
  prenom: string;
  nom: string;
  photo_url: string | null;
};

/** Une demande passager active, telle que lue en base (position déjà extraite). */
export type DemandeRaw = {
  id: string;
  sens: DemandeSens;
  culte_id: string;
  date: string;
  pickup_adresse: string;
  notes: string | null;
  created_at: string;
  position: GeoPoint | null;
  passager: MiniProfil | null;
  culte: { libelle: string; heure: string } | null;
};

/** Un trajet conducteur actif (offre), position déjà extraite. */
export type TrajetRaw = {
  id: string;
  sens: TrajetSens;
  culte_id: string;
  places_total: number;
  depart_adresse: string;
  position: GeoPoint | null;
  conducteur: MiniProfil | null;
};

/**
 * Extrait {lat,lng} d'une colonne PostGIS geography telle que sérialisée par
 * PostgREST : GeoJSON `{ type: "Point", coordinates: [lng, lat] }`.
 */
export function extractCoords(raw: unknown): GeoPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.type === "Point" && Array.isArray(obj.coordinates)) {
    const [lng, lat] = obj.coordinates as number[];
    if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  }
  return null;
}

/**
 * Un conducteur peut emmener un passager si le sens du trajet couvre celui de
 * la demande : même sens, ou trajet aller-retour. (Règle alignée sur l'API de
 * notification des conducteurs.)
 */
export function sensCompatible(demande: DemandeSens, trajet: TrajetSens): boolean {
  return trajet === demande || trajet === "aller_retour";
}

/** Nombre de jours entiers écoulés depuis la création de la demande. */
export function joursDattente(createdAtIso: string, now: number): number {
  const ms = now - new Date(createdAtIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/** Conducteur actif le plus proche, compatible culte + sens, avec sa distance. */
export type NearestDriver = {
  trajetId: string;
  conducteur: MiniProfil | null;
  depart_adresse: string;
  distanceKm: number;
};

/**
 * Pour une demande donnée, trouve le trajet actif compatible (même culte, sens
 * compatible, positions valides) dont le point de départ est le plus proche du
 * point de ramassage. Retourne `null` si aucun conducteur ne peut la couvrir.
 */
export function nearestDriverFor(
  demande: DemandeRaw,
  trajets: TrajetRaw[],
): NearestDriver | null {
  if (!demande.position) return null;
  let best: NearestDriver | null = null;
  for (const t of trajets) {
    if (t.culte_id !== demande.culte_id) continue;
    if (!sensCompatible(demande.sens, t.sens)) continue;
    if (!t.position) continue;
    const distanceKm = haversineKm(demande.position, t.position);
    if (!best || distanceKm < best.distanceKm) {
      best = {
        trajetId: t.id,
        conducteur: t.conducteur,
        depart_adresse: t.depart_adresse,
        distanceKm,
      };
    }
  }
  return best;
}

/** Une demande orpheline enrichie pour le panneau d'action. */
export type Orphelin = {
  id: string;
  passager: MiniProfil | null;
  culte: { libelle: string; heure: string } | null;
  sens: DemandeSens;
  date: string;
  pickup_adresse: string;
  notes: string | null;
  position: GeoPoint | null;
  joursAttente: number;
  /** Conducteur compatible le plus proche, ou null si personne ne couvre. */
  nearest: NearestDriver | null;
};

/**
 * Construit la liste actionnable des passagers en attente : enrichit chaque
 * demande de son ancienneté et du conducteur compatible le plus proche, puis
 * trie pour faire remonter l'urgence — d'abord ceux que personne ne peut
 * emmener, puis du plus ancien au plus récent.
 */
export function buildOrphelins(
  demandes: DemandeRaw[],
  trajets: TrajetRaw[],
  now: number,
): Orphelin[] {
  return demandes
    .map<Orphelin>((d) => ({
      id: d.id,
      passager: d.passager,
      culte: d.culte,
      sens: d.sens,
      date: d.date,
      pickup_adresse: d.pickup_adresse,
      notes: d.notes,
      position: d.position,
      joursAttente: joursDattente(d.created_at, now),
      nearest: nearestDriverFor(d, trajets),
    }))
    .sort((a, b) => {
      const aSansConducteur = a.nearest === null ? 0 : 1;
      const bSansConducteur = b.nearest === null ? 0 : 1;
      if (aSansConducteur !== bSansConducteur)
        return aSansConducteur - bSansConducteur;
      // Plus ancienne demande d'abord (joursAttente décroissant).
      return b.joursAttente - a.joursAttente;
    });
}

/** Compteurs de synthèse pour l'en-tête de la carte. */
export type MapStats = {
  nbDemandes: number;
  nbOffres: number;
  nbSansConducteur: number;
};

export function computeStats(
  orphelins: Orphelin[],
  trajets: TrajetRaw[],
): MapStats {
  return {
    nbDemandes: orphelins.length,
    nbOffres: trajets.filter((t) => t.position !== null).length,
    nbSansConducteur: orphelins.filter((o) => o.nearest === null).length,
  };
}
