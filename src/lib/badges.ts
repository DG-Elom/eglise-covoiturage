export type BadgeCouleur = "emerald" | "amber" | "sky" | "rose" | "violet" | "slate";

export type Badge = {
  id: string;
  label: string;
  icon: string;
  description: string;
  couleur: BadgeCouleur;
};

export type UserStats = {
  user_id: string;
  total_trajets_conducteur: number;
  total_passagers_transportes: number;
  total_trajets_passager: number;
  places_offertes_30j: number;
  note_moyenne: number | null;
  mois_courant_trajets: number;
};

export function computeBadges(stats: UserStats): Badge[] {
  const badges: Badge[] = [];
  const totalTrajets = stats.total_trajets_conducteur + stats.total_trajets_passager;

  if (totalTrajets >= 1) {
    badges.push({
      id: "premier-trajet",
      label: "Premier trajet",
      icon: "Sprout",
      description: "Tu as effectué ton premier trajet. Bienvenue dans la communauté !",
      couleur: "emerald",
    });
  }

  if (totalTrajets >= 10) {
    badges.push({
      id: "10-trajets",
      label: "10 trajets",
      icon: "TreeDeciduous",
      description: "10 trajets partagés. Tu es un fidèle du covoiturage !",
      couleur: "emerald",
    });
  }

  if (totalTrajets >= 50) {
    badges.push({
      id: "50-trajets",
      label: "50 trajets",
      icon: "Trees",
      description: "50 trajets ! Tu es un pilier de la communauté.",
      couleur: "emerald",
    });
  }

  if (
    stats.total_trajets_conducteur >= 5 &&
    stats.note_moyenne !== null &&
    stats.note_moyenne >= 4.5
  ) {
    badges.push({
      id: "conducteur-fidele",
      label: "Conducteur fidèle",
      icon: "Car",
      description: "Au moins 5 trajets conduits avec une note moyenne supérieure à 4,5.",
      couleur: "sky",
    });
  }

  if (
    stats.note_moyenne !== null &&
    stats.note_moyenne === 5 &&
    stats.total_trajets_conducteur >= 5
  ) {
    badges.push({
      id: "note-parfaite",
      label: "Note parfaite",
      icon: "Gem",
      description: "Note parfaite de 5/5 sur au moins 5 trajets. Exceptionnel !",
      couleur: "violet",
    });
  }

  if (stats.mois_courant_trajets >= 4) {
    badges.push({
      id: "actif-ce-mois",
      label: "Actif ce mois",
      icon: "Zap",
      description: "4 trajets ou plus ce mois-ci. Quel engagement !",
      couleur: "amber",
    });
  }

  return badges;
}
