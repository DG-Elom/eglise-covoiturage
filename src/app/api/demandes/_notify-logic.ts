type TrajetRow = {
  conducteur_id: string;
  culte_id: string;
  places_restantes: number;
};

export function filterConducteursByTrajetActif(
  trajets: TrajetRow[],
  culteId: string,
): string[] {
  const ids = new Set<string>();
  for (const t of trajets) {
    if (t.culte_id === culteId && t.places_restantes > 0) {
      ids.add(t.conducteur_id);
    }
  }
  return Array.from(ids);
}
