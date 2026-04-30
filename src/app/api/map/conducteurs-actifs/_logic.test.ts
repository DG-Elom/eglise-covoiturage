import { describe, it, expect } from "vitest";
import {
  anonymiserTrajet,
  type TrajetRaw,
  type TrajetAnonyme,
} from "./_logic";

const trajetBase: TrajetRaw = {
  id: "trajet-1",
  depart_lng: 6.175955,
  depart_lat: 49.146943,
  sens: "aller",
  places_total: 3,
  culte_libelle: "Culte du dimanche",
  culte_heure: "10:00:00",
  culte_jour: 0,
};

describe("anonymiserTrajet", () => {
  it("retourne les champs attendus sans données personnelles", () => {
    const result = anonymiserTrajet(trajetBase);
    expect(result.trajet_id).toBe("trajet-1");
    expect(result.sens).toBe("aller");
    expect(result.places_total).toBe(3);
    expect(result.jour_culte).toBe("Culte du dimanche");
    expect(result.heure_culte).toBe("10:00:00");
  });

  it("arrondit les coordonnées à 3 décimales (flou géographique)", () => {
    const result = anonymiserTrajet(trajetBase);
    expect(result.depart_lat).toBe(49.147);
    expect(result.depart_lng).toBe(6.176);
  });

  it("ne contient pas de prénom, nom, photo, téléphone", () => {
    const result = anonymiserTrajet(trajetBase) as Record<string, unknown>;
    expect(result).not.toHaveProperty("prenom");
    expect(result).not.toHaveProperty("nom");
    expect(result).not.toHaveProperty("photo_url");
    expect(result).not.toHaveProperty("telephone");
    expect(result).not.toHaveProperty("conducteur_id");
  });

  it("correspond au type TrajetAnonyme", () => {
    const result: TrajetAnonyme = anonymiserTrajet(trajetBase);
    expect(result).toBeDefined();
  });
});
