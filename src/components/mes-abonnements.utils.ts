import { formatProgramme } from "@/lib/dates";

type Sens = "aller" | "retour";

const JOURS = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export function formatSens(sens: Sens): string {
  return sens === "aller" ? "Aller" : "Retour";
}

/** Rétrocompat : affiche le jour pour un index unique. */
export function formatJour(jourSemaine: number): string {
  return JOURS[jourSemaine] ?? `Jour ${jourSemaine}`;
}

type ProgrammeInfo = {
  jours_semaine?: number[] | null;
  date_debut?: string | null;
  date_fin?: string | null;
  jour_semaine?: number | null;
};

/**
 * Formate l'affichage d'un programme : "Dim., Mer.", "1–21 juin 2030", etc.
 * Fallback sur jour_semaine si jours_semaine absent/vide.
 */
export function formatProgrammeJour(p: ProgrammeInfo): string {
  return formatProgramme({
    jours_semaine: p.jours_semaine ?? [],
    date_debut: p.date_debut ?? null,
    date_fin: p.date_fin ?? null,
    jour_semaine: p.jour_semaine,
  });
}

export async function desactiverAbonnement(id: string): Promise<boolean> {
  const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
  return res.ok;
}
