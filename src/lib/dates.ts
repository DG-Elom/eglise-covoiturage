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

/**
 * Calcule les prochaines occurrences pour un tableau de jours de semaine.
 * Les résultats sont triés par date, dédupliqués.
 */
export function nextOccurrencesMulti(jours: number[], count = 4): Date[] {
  if (jours.length === 0) return [];
  const unique = [...new Set(jours)];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  const cursor = new Date(today);
  while (out.length < count) {
    if (unique.includes(cursor.getDay()) && cursor >= today) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Génère toutes les dates dans [debut, fin] qui sont >= aujourd'hui.
 * debut/fin sont des chaînes ISO "YYYY-MM-DD".
 */
/** Parse "YYYY-MM-DD" as a local-midnight Date to avoid UTC offset issues. */
function parseDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a local Date back to "YYYY-MM-DD". */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Génère toutes les dates dans [debut, fin] qui sont >= aujourd'hui.
 * debut/fin sont des chaînes ISO "YYYY-MM-DD".
 */
export function occurrencesFromRange(debut: string, fin: string): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = parseDateLocal(debut);
  const end = parseDateLocal(fin);

  if (end < start) return [];

  const out: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor >= today) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const JOURS_COURTS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

/**
 * Formate un tableau de jours de semaine en chaîne lisible : "Dim., Mer."
 */
export function formatJours(jours: number[]): string {
  if (jours.length === 0) return "";
  return [...jours]
    .sort((a, b) => a - b)
    .map((j) => JOURS_COURTS[j] ?? `J${j}`)
    .join(", ");
}

type ProgrammeDisplay = {
  jours_semaine: number[];
  date_debut: string | null;
  date_fin: string | null;
  jour_semaine?: number | null;
};

/**
 * Formate l'affichage d'un programme :
 * - Récurrent : "Dim., Mer."
 * - Événement : "1–21 juin 2030" / "28 juin – 5 juil. 2030" / "15 sept. 2030"
 * - Fallback legacy : utilise jour_semaine si jours_semaine est vide et pas de dates
 */
export function formatProgramme(p: ProgrammeDisplay): string {
  if (p.jours_semaine.length > 0) {
    return formatJours(p.jours_semaine);
  }

  if (p.date_debut && p.date_fin) {
    const d1 = new Date(p.date_debut + "T00:00:00");
    const d2 = new Date(p.date_fin + "T00:00:00");

    const day1 = d1.getDate();
    const day2 = d2.getDate();
    const month1 = d1.toLocaleDateString("fr-FR", { month: "short" });
    const month2 = d2.toLocaleDateString("fr-FR", { month: "short" });
    const year1 = d1.getFullYear();
    const year2 = d2.getFullYear();

    if (p.date_debut === p.date_fin) {
      // même jour
      return `${day1} ${month1} ${year1}`;
    }

    if (d1.getMonth() === d2.getMonth() && year1 === year2) {
      // même mois : "1–21 juin 2030"
      return `${day1}–${day2} ${month1} ${year1}`;
    }

    // mois différents : "28 juin – 5 juil. 2030"
    const yearSuffix = year1 === year2 ? ` ${year2}` : ` ${year2}`;
    return `${day1} ${month1} – ${day2} ${month2}${yearSuffix}`;
  }

  // Fallback legacy
  if (p.jour_semaine != null) {
    return formatJours([p.jour_semaine]);
  }

  return "";
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
