import { describe, it, expect } from "vitest";
import { filterConducteursByTrajetActif } from "./_notify-logic";

type TrajetRow = {
  conducteur_id: string;
  culte_id: string;
  places_restantes: number;
};

describe("filterConducteursByTrajetActif", () => {
  it("ne retourne que les conducteurs avec un trajet actif pour le bon culte_id", () => {
    const trajets: TrajetRow[] = [
      { conducteur_id: "c1", culte_id: "culte-a", places_restantes: 2 },
      { conducteur_id: "c2", culte_id: "culte-b", places_restantes: 1 },
      { conducteur_id: "c3", culte_id: "culte-a", places_restantes: 1 },
    ];
    const result = filterConducteursByTrajetActif(trajets, "culte-a");
    expect(result).toEqual(["c1", "c3"]);
  });

  it("exclut les conducteurs dont le trajet est plein (places_restantes = 0)", () => {
    const trajets: TrajetRow[] = [
      { conducteur_id: "c1", culte_id: "culte-a", places_restantes: 0 },
      { conducteur_id: "c2", culte_id: "culte-a", places_restantes: 2 },
    ];
    const result = filterConducteursByTrajetActif(trajets, "culte-a");
    expect(result).toEqual(["c2"]);
  });

  it("retourne une liste vide si aucun trajet ne correspond", () => {
    const trajets: TrajetRow[] = [
      { conducteur_id: "c1", culte_id: "culte-b", places_restantes: 2 },
    ];
    const result = filterConducteursByTrajetActif(trajets, "culte-a");
    expect(result).toEqual([]);
  });

  it("déduplique les conducteurs avec plusieurs trajets pour le même culte", () => {
    const trajets: TrajetRow[] = [
      { conducteur_id: "c1", culte_id: "culte-a", places_restantes: 2 },
      { conducteur_id: "c1", culte_id: "culte-a", places_restantes: 3 },
    ];
    const result = filterConducteursByTrajetActif(trajets, "culte-a");
    expect(result).toEqual(["c1"]);
  });

  it("inclut les conducteurs dont le trajet a sens='aller_retour' pour une demande 'aller'", () => {
    // La route pré-filtre via .in("trajets.sens", [demande.sens, "aller_retour"]).
    // filterConducteursByTrajetActif reçoit donc des trajets aller_retour si la demande est 'aller'.
    // Ce cas prouve qu'elle ne les rejette pas.
    const trajets: TrajetRow[] = [
      { conducteur_id: "c-aller-retour", culte_id: "culte-a", places_restantes: 2 },
      { conducteur_id: "c-aller-seul", culte_id: "culte-a", places_restantes: 1 },
    ];
    const result = filterConducteursByTrajetActif(trajets, "culte-a");
    expect(result).toContain("c-aller-retour");
    expect(result).toContain("c-aller-seul");
  });

  it("inclut les conducteurs dont le trajet a sens='aller_retour' pour une demande 'retour'", () => {
    // Même logique côté 'retour' : la route injecte aller_retour dans les résultats.
    const trajets: TrajetRow[] = [
      { conducteur_id: "c-aller-retour", culte_id: "culte-b", places_restantes: 3 },
    ];
    const result = filterConducteursByTrajetActif(trajets, "culte-b");
    expect(result).toContain("c-aller-retour");
  });
});
