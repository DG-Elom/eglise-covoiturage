export type EngageKind = "engage_d2" | "engage_d7" | "engage_d14";

/**
 * Retourne le kind de relance à envoyer selon l'âge du profil en jours
 * depuis l'acceptation de la charte.
 *
 * Bornes :
 *  2  ≤ age < 7  → engage_d2
 *  7  ≤ age < 14 → engage_d7
 *  14 ≤ age < 28 → engage_d14
 *  Hors plage    → null (pas de relance)
 */
export function chooseEngageKind(ageJours: number): EngageKind | null {
  if (ageJours >= 2 && ageJours < 7) return "engage_d2";
  if (ageJours >= 7 && ageJours < 14) return "engage_d7";
  if (ageJours >= 14 && ageJours < 28) return "engage_d14";
  return null;
}
