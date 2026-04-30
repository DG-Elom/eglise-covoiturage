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

export function formatJour(jourSemaine: number): string {
  return JOURS[jourSemaine] ?? `Jour ${jourSemaine}`;
}

export async function desactiverAbonnement(id: string): Promise<boolean> {
  const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
  return res.ok;
}
