export type RawStats = {
  user_id: string;
  trajets_proposes: number;
  demandes_recues: number;
  demandes_acceptees: number;
  passagers_transportes: number;
  km_detour_consenti: number;
  median_minutes_reponse: number | null;
  taux_acceptation: number | null;
};

const WEIGHTS = {
  passagers: 0.30,
  detour: 0.25,
  popularite: 0.20,
  reactivite: 0.15,
  trajets: 0.10,
} as const;

function maxOf(rows: RawStats[], key: keyof RawStats): number {
  const values = rows.map((r) => Number(r[key] ?? 0));
  return Math.max(...values) || 1;
}

export function computeTopScore(
  rows: RawStats[],
): Array<RawStats & { score: number }> {
  const eligible = rows.filter((r) => r.passagers_transportes >= 1);
  if (eligible.length === 0) return [];

  const maxPassagers = maxOf(eligible, "passagers_transportes");
  const maxDetour = maxOf(eligible, "km_detour_consenti");
  const maxDemandes = maxOf(eligible, "demandes_recues");
  const maxTrajets = maxOf(eligible, "trajets_proposes");

  const responseTimes = eligible
    .map((r) => r.median_minutes_reponse)
    .filter((v): v is number => v !== null);
  const minReponse =
    responseTimes.length > 0 ? Math.min(...responseTimes) : null;

  const scored = eligible.map((r) => {
    const passagers = r.passagers_transportes / maxPassagers;
    const detour = r.km_detour_consenti / maxDetour;
    const popularite =
      (r.demandes_recues / maxDemandes) * (r.taux_acceptation ?? 0);
    const trajets = r.trajets_proposes / maxTrajets;
    const reactivite =
      r.median_minutes_reponse === null || minReponse === null
        ? 0
        : Math.min(1, minReponse / r.median_minutes_reponse);

    const score =
      WEIGHTS.passagers * passagers +
      WEIGHTS.detour * detour +
      WEIGHTS.popularite * popularite +
      WEIGHTS.reactivite * reactivite +
      WEIGHTS.trajets * trajets;

    return { ...r, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}
