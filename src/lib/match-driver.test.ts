import { describe, it, expect } from "vitest";
import {
  nearestCompatibleDriver,
  compatibleDrivers,
  type DemandeMatch,
  type TrajetMatch,
} from "./match-driver";

// Metz centre-ville approximatif comme point de départ de la demande.
const demande: DemandeMatch = {
  culte_id: "culte-1",
  sens: "aller",
  pickup: { lat: 49.1193, lng: 6.1757 },
};

function trajet(over: Partial<TrajetMatch>): TrajetMatch {
  return {
    id: "t",
    culte_id: "culte-1",
    sens: "aller",
    depart: { lat: 49.12, lng: 6.18 },
    places: 3,
    ...over,
  };
}

describe("nearestCompatibleDriver", () => {
  it("exclut un trajet d'un culte différent", () => {
    const trajets = [trajet({ id: "autre-culte", culte_id: "culte-2" })];
    expect(nearestCompatibleDriver(demande, trajets)).toBeNull();
  });

  it("exclut un trajet au sens incompatible", () => {
    // demande aller, trajet retour seul -> incompatible
    const trajets = [trajet({ id: "retour", sens: "retour" })];
    expect(nearestCompatibleDriver(demande, trajets)).toBeNull();
  });

  it("accepte un trajet aller_retour pour une demande aller", () => {
    const trajets = [trajet({ id: "ar", sens: "aller_retour" })];
    const res = nearestCompatibleDriver(demande, trajets);
    expect(res?.trajet.id).toBe("ar");
  });

  it("renvoie le conducteur le plus proche parmi plusieurs", () => {
    const trajets = [
      trajet({ id: "loin", depart: { lat: 49.3, lng: 6.4 } }),
      trajet({ id: "proche", depart: { lat: 49.1195, lng: 6.176 } }),
      trajet({ id: "moyen", depart: { lat: 49.15, lng: 6.2 } }),
    ];
    const res = nearestCompatibleDriver(demande, trajets);
    expect(res?.trajet.id).toBe("proche");
    expect(res?.distanceKm).toBeGreaterThan(0);
  });

  it("renvoie null quand aucune offre", () => {
    expect(nearestCompatibleDriver(demande, [])).toBeNull();
  });

  it("exclut un trajet sans place disponible", () => {
    const trajets = [trajet({ id: "complet", places: 0 })];
    expect(nearestCompatibleDriver(demande, trajets)).toBeNull();
  });

  it("exclut un trajet sans position valide", () => {
    const trajets = [trajet({ id: "no-pos", depart: null })];
    expect(nearestCompatibleDriver(demande, trajets)).toBeNull();
  });

  it("renvoie null si la position de la demande est invalide", () => {
    const mauvaise: DemandeMatch = {
      ...demande,
      pickup: { lat: NaN, lng: 6.1 },
    };
    expect(nearestCompatibleDriver(mauvaise, [trajet({})])).toBeNull();
  });
});

describe("compatibleDrivers", () => {
  it("trie tous les compatibles du plus proche au plus loin", () => {
    const trajets = [
      trajet({ id: "loin", depart: { lat: 49.3, lng: 6.4 } }),
      trajet({ id: "proche", depart: { lat: 49.1195, lng: 6.176 } }),
    ];
    const res = compatibleDrivers(demande, trajets);
    expect(res.map((r) => r.trajet.id)).toEqual(["proche", "loin"]);
  });
});
