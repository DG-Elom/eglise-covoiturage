export function nextOccurrences(jourSemaine: number, count = 4): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  const cursor = new Date(today);
  while (out.length < count) {
    if (cursor.getDay() === jourSemaine && cursor >= today) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcule les `count` prochaines occurrences d'un jour de semaine, au format
 * `YYYY-MM-DD`. Déterministe : la date de référence est injectable (`from`),
 * ce qui rend le helper testable sans dépendre de l'horloge.
 *
 * Le jour courant compte comme une occurrence s'il tombe sur `jourSemaine`.
 * Utilisé pour matérialiser les N prochaines semaines d'un trajet récurrent.
 */
export function nextOccurrenceDates(
  jourSemaine: number,
  count: number,
  from: Date = new Date(),
): string[] {
  if (count <= 0) return [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const out: string[] = [];
  // Borne dure : au pire 7 jours pour atteindre le 1er créneau, puis 7/occurrence.
  const maxIterations = 7 * count + 7;
  for (let i = 0; i < maxIterations && out.length < count; i++) {
    if (cursor.getDay() === jourSemaine) {
      out.push(toDateString(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
