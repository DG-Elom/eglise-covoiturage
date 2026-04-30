import { describe, it, expect } from "vitest";
import { computeBadges, type UserStats } from "./badges";

function makeStats(overrides: Partial<UserStats> = {}): UserStats {
  return {
    user_id: "test-user",
    total_trajets_conducteur: 0,
    total_passagers_transportes: 0,
    total_trajets_passager: 0,
    places_offertes_30j: 0,
    note_moyenne: null,
    mois_courant_trajets: 0,
    ...overrides,
  };
}

describe("computeBadges", () => {
  describe("Premier trajet", () => {
    it("ne donne pas le badge si aucun trajet", () => {
      const badges = computeBadges(makeStats());
      const ids = badges.map((b) => b.id);
      expect(ids).not.toContain("premier-trajet");
    });

    it("donne le badge dès 1 trajet passager", () => {
      const badges = computeBadges(makeStats({ total_trajets_passager: 1 }));
      expect(badges.map((b) => b.id)).toContain("premier-trajet");
    });

    it("donne le badge dès 1 trajet conducteur", () => {
      const badges = computeBadges(makeStats({ total_trajets_conducteur: 1 }));
      expect(badges.map((b) => b.id)).toContain("premier-trajet");
    });
  });

  describe("10 trajets", () => {
    it("ne donne pas le badge à 9 trajets", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_passager: 5, total_trajets_conducteur: 4 }),
      );
      expect(badges.map((b) => b.id)).not.toContain("10-trajets");
    });

    it("donne le badge exactement à 10 trajets", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_passager: 5, total_trajets_conducteur: 5 }),
      );
      expect(badges.map((b) => b.id)).toContain("10-trajets");
    });

    it("donne le badge au-delà de 10 trajets", () => {
      const badges = computeBadges(makeStats({ total_trajets_conducteur: 15 }));
      expect(badges.map((b) => b.id)).toContain("10-trajets");
    });
  });

  describe("50 trajets", () => {
    it("ne donne pas le badge à 49 trajets", () => {
      const badges = computeBadges(makeStats({ total_trajets_conducteur: 49 }));
      expect(badges.map((b) => b.id)).not.toContain("50-trajets");
    });

    it("donne le badge exactement à 50 trajets", () => {
      const badges = computeBadges(makeStats({ total_trajets_conducteur: 50 }));
      expect(badges.map((b) => b.id)).toContain("50-trajets");
    });
  });

  describe("Conducteur fidèle", () => {
    it("ne donne pas le badge sans assez de trajets conducteur", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_conducteur: 4, note_moyenne: 4.8 }),
      );
      expect(badges.map((b) => b.id)).not.toContain("conducteur-fidele");
    });

    it("ne donne pas le badge avec note insuffisante", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_conducteur: 5, note_moyenne: 4.4 }),
      );
      expect(badges.map((b) => b.id)).not.toContain("conducteur-fidele");
    });

    it("ne donne pas le badge sans note", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_conducteur: 5, note_moyenne: null }),
      );
      expect(badges.map((b) => b.id)).not.toContain("conducteur-fidele");
    });

    it("donne le badge avec 5 trajets conducteur et note >= 4.5", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_conducteur: 5, note_moyenne: 4.5 }),
      );
      expect(badges.map((b) => b.id)).toContain("conducteur-fidele");
    });

    it("donne le badge avec note exactement 4.5", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_conducteur: 10, note_moyenne: 4.5 }),
      );
      expect(badges.map((b) => b.id)).toContain("conducteur-fidele");
    });
  });

  describe("Note parfaite", () => {
    it("ne donne pas le badge sans note", () => {
      const badges = computeBadges(makeStats({ note_moyenne: null }));
      expect(badges.map((b) => b.id)).not.toContain("note-parfaite");
    });

    it("ne donne pas le badge si note < 5", () => {
      const badges = computeBadges(
        makeStats({ note_moyenne: 4.9, total_trajets_conducteur: 10 }),
      );
      expect(badges.map((b) => b.id)).not.toContain("note-parfaite");
    });

    it("ne donne pas le badge si trop peu de trajets notés (< 5)", () => {
      const badges = computeBadges(
        makeStats({ note_moyenne: 5, total_trajets_conducteur: 4 }),
      );
      expect(badges.map((b) => b.id)).not.toContain("note-parfaite");
    });

    it("donne le badge avec note 5 et au moins 5 trajets conducteur", () => {
      const badges = computeBadges(
        makeStats({ note_moyenne: 5, total_trajets_conducteur: 5 }),
      );
      expect(badges.map((b) => b.id)).toContain("note-parfaite");
    });
  });

  describe("Actif ce mois", () => {
    it("ne donne pas le badge avec 3 trajets ce mois", () => {
      const badges = computeBadges(makeStats({ mois_courant_trajets: 3 }));
      expect(badges.map((b) => b.id)).not.toContain("actif-ce-mois");
    });

    it("donne le badge exactement à 4 trajets ce mois", () => {
      const badges = computeBadges(makeStats({ mois_courant_trajets: 4 }));
      expect(badges.map((b) => b.id)).toContain("actif-ce-mois");
    });
  });

  describe("Badges cumulatifs", () => {
    it("donne plusieurs badges si les critères sont remplis", () => {
      const badges = computeBadges(
        makeStats({
          total_trajets_conducteur: 50,
          total_trajets_passager: 10,
          note_moyenne: 5,
          mois_courant_trajets: 5,
        }),
      );
      const ids = badges.map((b) => b.id);
      expect(ids).toContain("premier-trajet");
      expect(ids).toContain("10-trajets");
      expect(ids).toContain("50-trajets");
      expect(ids).toContain("conducteur-fidele");
      expect(ids).toContain("note-parfaite");
      expect(ids).toContain("actif-ce-mois");
    });
  });

  describe("Structure des badges", () => {
    it("chaque badge a les champs requis", () => {
      const badges = computeBadges(
        makeStats({ total_trajets_conducteur: 50, note_moyenne: 5, mois_courant_trajets: 4 }),
      );
      for (const badge of badges) {
        expect(badge.id).toBeTruthy();
        expect(badge.label).toBeTruthy();
        expect(badge.icon).toBeTruthy();
        expect(badge.description).toBeTruthy();
        expect(["emerald", "amber", "sky", "rose", "violet", "slate"]).toContain(badge.couleur);
      }
    });
  });
});
