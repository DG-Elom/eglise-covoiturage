/**
 * Calcul d'impact communautaire (covoiturage ICC Metz).
 *
 * Fonctions PURES : à partir de lignes brutes (telles que lues depuis Supabase)
 * vers des agrégats affichables. Centralise la logique partagée entre
 * la route IA `weekly-summary` et la carte d'impact publique `/impact`.
 */

/** Distance moyenne estimée par trajet (km), utilisée pour les km cumulés. */
export const KM_MOYEN_PAR_TRAJET = 20;

/** Émission de CO2 évitée par km et par passager covoituré (kg). */
export const CO2_KG_PAR_KM_PASSAGER = 0.12;

/** Une instance de trajet brute (date + annulation). */
export interface TrajetInstanceRow {
  annule_par_conducteur: boolean | null;
}

/** Une réservation brute (statut). */
export interface ReservationRow {
  statut: string | null;
}

/** Lignes brutes nécessaires au calcul d'impact. */
export interface ImpactRawRows {
  trajetsInstances: TrajetInstanceRow[];
  reservations: ReservationRow[];
  nouveauxProfils: number;
  messages: number;
}

/** Agrégats bruts (avant dérivation CO2). */
export interface ImpactRawData {
  trajetsEffectues: number;
  passagersTransportes: number;
  nouveauxInscrits: number;
  messagesEchanges: number;
  kmCumules: number;
}

/** Agrégats finaux affichables. */
export interface ImpactStats extends ImpactRawData {
  co2EconomiseKg: number;
}

/**
 * Agrège des lignes brutes en compteurs.
 * - trajetsEffectues : instances non annulées par le conducteur.
 * - passagersTransportes : réservations au statut "completed".
 * - kmCumules : trajets effectués × distance moyenne estimée.
 */
export function aggregateImpactRows(rows: ImpactRawRows): ImpactRawData {
  const trajetsEffectues = rows.trajetsInstances.filter(
    (t) => t.annule_par_conducteur !== true,
  ).length;
  const passagersTransportes = rows.reservations.filter(
    (r) => r.statut === "completed",
  ).length;
  const kmCumules = trajetsEffectues * KM_MOYEN_PAR_TRAJET;

  return {
    trajetsEffectues,
    passagersTransportes,
    nouveauxInscrits: Math.max(0, Math.trunc(rows.nouveauxProfils)),
    messagesEchanges: Math.max(0, Math.trunc(rows.messages)),
    kmCumules,
  };
}

/**
 * Dérive les agrégats finaux (ajoute le CO2 évité estimé) depuis des compteurs.
 * Comportement identique à l'ancien `computeWeeklyStats` (anti-duplication).
 */
export function computeImpactStats(raw: ImpactRawData): ImpactStats {
  const co2 =
    Math.round(
      raw.kmCumules * CO2_KG_PAR_KM_PASSAGER * raw.passagersTransportes * 100,
    ) / 100;
  return { ...raw, co2EconomiseKg: co2 };
}

/** Pipeline complet : lignes brutes -> agrégats finaux affichables. */
export function computeImpactFromRows(rows: ImpactRawRows): ImpactStats {
  return computeImpactStats(aggregateImpactRows(rows));
}

/**
 * Phrase de partage de la carte d'impact.
 * Ex : "Ce mois : 42 trajets · 18 personnes · 230 km partagés · 31 kg CO2 évités 🌱"
 */
export function formatImpactShareText(stats: ImpactStats): string {
  return [
    `Ce mois : ${stats.trajetsEffectues} trajets`,
    `${stats.passagersTransportes} personnes`,
    `${Math.round(stats.kmCumules)} km partagés`,
    `${Math.round(stats.co2EconomiseKg)} kg CO2 évités 🌱`,
  ].join(" · ");
}
