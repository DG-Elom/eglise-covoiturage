export type EngageKind = "engage_d2" | "engage_d7" | "engage_d14";

export interface InactifProfile {
  id: string;
  prenom: string;
  nom: string;
  charte_acceptee_at: string;
}

export interface ReservationRow {
  passager_id: string;
}

export interface EngagementLogRow {
  user_id: string;
  kind: string;
}

export interface EligibleProfile {
  id: string;
  prenom: string;
  nom: string;
  charte_acceptee_at: string;
  age_jours: number;
  next_kind: EngageKind | null;
}

export function chooseKind(ageJours: number): EngageKind | null {
  if (ageJours >= 2 && ageJours < 7) return "engage_d2";
  if (ageJours >= 7 && ageJours < 14) return "engage_d7";
  if (ageJours >= 14 && ageJours < 28) return "engage_d14";
  return null;
}

/**
 * Agrège en mémoire les passagers éligibles à une relance.
 * Aucune requête DB — les données sont déjà chargées par le caller.
 */
export function buildEligibles(
  inactifs: InactifProfile[],
  reservations: ReservationRow[],
  logs: EngagementLogRow[],
  now: number,
): EligibleProfile[] {
  const idsAvecResa = new Set(reservations.map((r) => r.passager_id));

  // Set de clés "userId:kind" pour vérifier si un kind a déjà été envoyé
  const logKeys = new Set(logs.map((l) => `${l.user_id}:${l.kind}`));

  const eligibles: EligibleProfile[] = [];

  for (const p of inactifs) {
    if (idsAvecResa.has(p.id)) continue;

    const ageJours = Math.floor(
      (now - new Date(p.charte_acceptee_at).getTime()) / (24 * 3600 * 1000),
    );
    const nextKind = chooseKind(ageJours);
    if (!nextKind) continue;

    if (logKeys.has(`${p.id}:${nextKind}`)) continue;

    eligibles.push({
      id: p.id,
      prenom: p.prenom,
      nom: p.nom,
      charte_acceptee_at: p.charte_acceptee_at,
      age_jours: ageJours,
      next_kind: nextKind,
    });
  }

  return eligibles;
}
