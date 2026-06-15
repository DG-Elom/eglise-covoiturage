// Utilitaires purs pour weekly-digest — testables hors Deno.
// Aucune dépendance réseau, aucun import Deno.

export type UserRole = "passager" | "conducteur" | "les_deux";

export interface CtaResult {
  label: string;
  url: string;
  /** Message de contexte pour l'email (différent du label du bouton) */
  message: string;
}

export interface ChooseCtaInput {
  role: UserRole;
  hasActiveTrajet: boolean;
}

export interface SmsBodyInput {
  prenom: string;
  role: UserRole;
  hasActiveTrajet: boolean;
  appUrl: string;
  nbPlacesLibres: number;
  nextDate: string; // YYYY-MM-DD
}

/** Calcule le numéro de semaine ISO 8601 et l'année ISO pour une date donnée. */
export function isoWeekNumber(date: Date): { year: number; week: number } {
  // Calcul standard : jeudi de la semaine courante détermine l'année ISO.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Jour de semaine ISO : lundi=1 … dimanche=7
  const dayOfWeek = d.getUTCDay() || 7;
  // Décale au jeudi de la même semaine
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const isoYear = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return { year: isoYear, week };
}

/**
 * Retourne la clé d'idempotence hebdomadaire pour engagement_log.
 * Format : `weekly_digest_YYYYWww` (ex: weekly_digest_2026W24).
 */
export function getIsoWeekKey(date: Date): string {
  const { year, week } = isoWeekNumber(date);
  return `weekly_digest_${year}W${String(week).padStart(2, "0")}`;
}

/**
 * Choisit le CTA et le message adapté selon le rôle et la présence d'un trajet actif.
 */
export function chooseCta(input: ChooseCtaInput): CtaResult {
  const { role, hasActiveTrajet } = input;

  if (role === "passager") {
    return {
      label: "Réserve ta place pour ce week-end",
      url: "/trajets/recherche",
      message: "Des conducteurs t'attendent. Trouve ta place en 30 secondes.",
    };
  }

  // conducteur ou les_deux
  if (hasActiveTrajet) {
    return {
      label: "Voir les demandes en attente",
      url: "/dashboard",
      message: "Merci de proposer ton trajet ! Pense à vérifier les demandes en attente.",
    };
  }

  return {
    label: "Propose ton trajet",
    url: "/trajets/nouveau",
    message: "La communauté a besoin de conducteurs. Proposer un trajet prend moins de 2 minutes.",
  };
}

/**
 * Construit le corps SMS (<= 160 chars) pour le digest hebdomadaire.
 */
export function buildSmsBody(input: SmsBodyInput): string {
  const { prenom, role, hasActiveTrajet, appUrl, nbPlacesLibres, nextDate } = input;
  const cta = chooseCta({ role, hasActiveTrajet });
  const fullUrl = `${appUrl}${cta.url}`;

  // Format date court : "dim. 14/06"
  const d = new Date(nextDate + "T00:00:00Z");
  const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const jourLabel = jours[d.getUTCDay()];
  const dateLabel = `${jourLabel} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

  // Construit le message de base puis tronque le prénom si nécessaire pour rester <= 160
  const buildMsg = (p: string) => {
    if (role === "passager") {
      return `${p}, programme ${dateLabel} : ${nbPlacesLibres} place${nbPlacesLibres > 1 ? "s" : ""} dispo. Réserve : ${fullUrl}`;
    }
    if (hasActiveTrajet) {
      return `${p}, merci pour ton trajet ! Vérifie tes demandes : ${fullUrl}`;
    }
    return `${p}, propose ton trajet pour le programme ${dateLabel} : ${fullUrl}`;
  };

  let msg = buildMsg(prenom);
  if (msg.length <= 160) return msg;

  // Tronque le prénom si trop long
  let truncated = prenom;
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1);
    msg = buildMsg(truncated + ".");
    if (msg.length <= 160) return msg;
  }
  // Fallback sans prénom
  return buildMsg("").slice(0, 160);
}
