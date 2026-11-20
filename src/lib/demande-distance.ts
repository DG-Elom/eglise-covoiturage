import { haversineKm, type LatLng } from "@/lib/distance";

export type DepartConducteur = {
  position: LatLng | null;
  culte_id: string;
  sens: "aller" | "retour" | "aller_retour";
};

export type DemandePosition = {
  position: LatLng | null;
  culte_id: string | null;
  sens: "aller" | "retour";
};

/**
 * Distance à vol d'oiseau entre le point de prise en charge d'une demande et
 * le départ le plus proche parmi les trajets actifs du conducteur.
 * Priorité aux trajets compatibles (même programme, sens couvert) ; sinon
 * repli sur le départ le plus proche, signalé par `compatible: false`.
 */
export function distanceDepuisDepartsKm(
  demande: DemandePosition,
  departs: DepartConducteur[],
): { km: number; compatible: boolean } | null {
  const pickup = demande.position;
  if (!pickup) return null;

  let best: { km: number; compatible: boolean } | null = null;
  for (const d of departs) {
    if (!d.position) continue;
    const compatible =
      d.culte_id === demande.culte_id &&
      (d.sens === demande.sens || d.sens === "aller_retour");
    const km = haversineKm(pickup, d.position);
    if (
      !best ||
      (compatible && !best.compatible) ||
      (compatible === best.compatible && km < best.km)
    ) {
      best = { km, compatible };
    }
  }
  return best;
}
