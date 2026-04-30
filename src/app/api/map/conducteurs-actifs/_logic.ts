import { roundCoords } from "@/lib/geo-privacy";

export type TrajetRaw = {
  id: string;
  depart_lng: number;
  depart_lat: number;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  culte_libelle: string;
  culte_heure: string;
  culte_jour: number;
};

export type TrajetAnonyme = {
  trajet_id: string;
  depart_lat: number;
  depart_lng: number;
  sens: "aller" | "retour" | "aller_retour";
  places_total: number;
  jour_culte: string;
  heure_culte: string;
};

export function anonymiserTrajet(trajet: TrajetRaw): TrajetAnonyme {
  const { lat, lng } = roundCoords(trajet.depart_lat, trajet.depart_lng);
  return {
    trajet_id: trajet.id,
    depart_lat: lat,
    depart_lng: lng,
    sens: trajet.sens,
    places_total: trajet.places_total,
    jour_culte: trajet.culte_libelle,
    heure_culte: trajet.culte_heure,
  };
}
