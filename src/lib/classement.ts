import type { TopConducteur } from "@/app/api/top-conducteurs/route";
import { formatDetour } from "@/lib/detour";

export type ClassementHighlight = {
  icon: string;
  label: string;
};

export type ClassementEntry = TopConducteur & {
  rang: number;
  highlight: ClassementHighlight;
};

function passagersLabel(n: number): string {
  return `${n} passager${n > 1 ? "s" : ""} ce mois`;
}

/**
 * Choisit le fait saillant d'un conducteur, en privilégiant ce sur quoi il est
 * en tête de la communauté (passagers > détour > trajets). Sert de "badge"
 * léger à afficher dans la liste. Logique pure et testable.
 */
export function getHighlight(
  conducteur: TopConducteur,
  all: TopConducteur[],
): ClassementHighlight {
  const maxPassagers = Math.max(0, ...all.map((c) => c.passagersTransportes));
  const maxDetour = Math.max(0, ...all.map((c) => c.kmDetourConsenti));
  const maxTrajets = Math.max(0, ...all.map((c) => c.trajetsProposes));

  if (conducteur.passagersTransportes === maxPassagers && maxPassagers > 0) {
    return { icon: "🚀", label: passagersLabel(conducteur.passagersTransportes) };
  }
  if (conducteur.kmDetourConsenti === maxDetour && maxDetour > 0) {
    return {
      icon: "🛣️",
      label: `${formatDetour(conducteur.kmDetourConsenti)} de détour`,
    };
  }
  if (conducteur.trajetsProposes === maxTrajets && maxTrajets > 0) {
    const n = conducteur.trajetsProposes;
    return {
      icon: "📅",
      label: `${n} trajet${n > 1 ? "s" : ""} proposé${n > 1 ? "s" : ""}`,
    };
  }

  return { icon: "🚀", label: passagersLabel(conducteur.passagersTransportes) };
}

/**
 * Transforme la liste ordonnée des conducteurs (déjà triée par score côté API)
 * en entrées de classement : rang 1-indexé + fait saillant. Ne re-trie pas,
 * la source de vérité du tri reste `computeTopScore`.
 */
export function buildClassement(
  conducteurs: TopConducteur[],
): ClassementEntry[] {
  return conducteurs.map((c, i) => ({
    ...c,
    rang: i + 1,
    highlight: getHighlight(c, conducteurs),
  }));
}

export const MEDALS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};
