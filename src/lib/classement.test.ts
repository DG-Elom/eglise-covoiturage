import { describe, it, expect } from "vitest";
import { buildClassement, getHighlight, MEDALS } from "./classement";
import type { TopConducteur } from "@/app/api/top-conducteurs/route";

function makeConducteur(overrides: Partial<TopConducteur> = {}): TopConducteur {
  return {
    id: "user-1",
    prenom: "Jean",
    nom: "Dupont",
    photoUrl: null,
    passagersTransportes: 5,
    kmDetourConsenti: 10,
    trajetsProposes: 3,
    ...overrides,
  };
}

describe("buildClassement", () => {
  it("assigne des rangs 1-indexés dans l'ordre reçu (ne re-trie pas)", () => {
    const entries = buildClassement([
      makeConducteur({ id: "a" }),
      makeConducteur({ id: "b" }),
      makeConducteur({ id: "c" }),
    ]);
    expect(entries.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(entries.map((e) => e.rang)).toEqual([1, 2, 3]);
  });

  it("retourne un tableau vide pour une entrée vide", () => {
    expect(buildClassement([])).toEqual([]);
  });

  it("conserve toutes les propriétés d'origine du conducteur", () => {
    const [entry] = buildClassement([makeConducteur({ id: "x", prenom: "Marie" })]);
    expect(entry.id).toBe("x");
    expect(entry.prenom).toBe("Marie");
    expect(entry.highlight).toBeDefined();
  });
});

describe("getHighlight", () => {
  it("met en avant les passagers quand le conducteur est le meilleur transporteur", () => {
    const all = [
      makeConducteur({ id: "a", passagersTransportes: 12, kmDetourConsenti: 2, trajetsProposes: 1 }),
      makeConducteur({ id: "b", passagersTransportes: 3, kmDetourConsenti: 50, trajetsProposes: 9 }),
    ];
    const hl = getHighlight(all[0], all);
    expect(hl.icon).toBe("🚀");
    expect(hl.label).toContain("12 passagers");
  });

  it("met en avant le détour quand le conducteur a le plus gros sacrifice (et pas le top passagers)", () => {
    const all = [
      makeConducteur({ id: "a", passagersTransportes: 12, kmDetourConsenti: 2, trajetsProposes: 1 }),
      makeConducteur({ id: "b", passagersTransportes: 3, kmDetourConsenti: 50, trajetsProposes: 1 }),
    ];
    const hl = getHighlight(all[1], all);
    expect(hl.icon).toBe("🛣️");
    expect(hl.label).toContain("détour");
  });

  it("met en avant les trajets proposés en dernier recours", () => {
    const all = [
      makeConducteur({ id: "a", passagersTransportes: 12, kmDetourConsenti: 50, trajetsProposes: 1 }),
      makeConducteur({ id: "b", passagersTransportes: 3, kmDetourConsenti: 2, trajetsProposes: 9 }),
    ];
    const hl = getHighlight(all[1], all);
    expect(hl.icon).toBe("📅");
    expect(hl.label).toContain("trajets proposés");
  });

  it("accorde le singulier pour 1 passager", () => {
    const all = [makeConducteur({ passagersTransportes: 1, kmDetourConsenti: 0, trajetsProposes: 0 })];
    const hl = getHighlight(all[0], all);
    expect(hl.label).toBe("1 passager ce mois");
  });

  it("ne crash pas et retombe sur les passagers quand toutes les stats sont à zéro", () => {
    const all = [
      makeConducteur({ passagersTransportes: 0, kmDetourConsenti: 0, trajetsProposes: 0 }),
    ];
    const hl = getHighlight(all[0], all);
    expect(hl.icon).toBe("🚀");
    expect(hl.label).toContain("0 passager");
  });
});

describe("MEDALS", () => {
  it("attribue les médailles au podium et rien au-delà", () => {
    expect(MEDALS[1]).toBe("🥇");
    expect(MEDALS[2]).toBe("🥈");
    expect(MEDALS[3]).toBe("🥉");
    expect(MEDALS[4]).toBeUndefined();
  });
});
