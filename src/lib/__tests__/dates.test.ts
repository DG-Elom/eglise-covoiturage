import { describe, it, expect } from "vitest";
import { nextOccurrenceDates } from "../dates";

describe("nextOccurrenceDates", () => {
  // 2026-06-01 est un lundi (getDay() === 1).
  const monday = new Date("2026-06-01T12:00:00");

  it("inclut le jour courant s'il tombe sur le jour visé", () => {
    // dimanche = 0 ; 2026-06-07 est le prochain dimanche.
    const result = nextOccurrenceDates(0, 4, new Date("2026-06-07T08:00:00"));
    expect(result[0]).toBe("2026-06-07");
  });

  it("calcule les 4 prochains dimanches à partir d'un lundi", () => {
    const result = nextOccurrenceDates(0, 4, monday);
    expect(result).toEqual([
      "2026-06-07",
      "2026-06-14",
      "2026-06-21",
      "2026-06-28",
    ]);
  });

  it("respecte le count demandé", () => {
    expect(nextOccurrenceDates(0, 1, monday)).toHaveLength(1);
    expect(nextOccurrenceDates(0, 8, monday)).toHaveLength(8);
  });

  it("renvoie un tableau vide pour count <= 0", () => {
    expect(nextOccurrenceDates(0, 0, monday)).toEqual([]);
    expect(nextOccurrenceDates(0, -3, monday)).toEqual([]);
  });

  it("avance d'une semaine quand le jour courant est le jour visé", () => {
    // lundi (1), à partir d'un lundi : la 1re occurrence est le jour même.
    const result = nextOccurrenceDates(1, 3, monday);
    expect(result).toEqual(["2026-06-01", "2026-06-08", "2026-06-15"]);
  });

  it("produit des dates espacées d'exactement 7 jours", () => {
    const result = nextOccurrenceDates(3, 5, monday); // mercredis
    for (let i = 1; i < result.length; i++) {
      const prev = new Date(`${result[i - 1]}T00:00:00`);
      const cur = new Date(`${result[i]}T00:00:00`);
      const diffDays = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
    }
  });

  it("gère un passage de mois/année", () => {
    // 2026-12-28 est un lundi ; prochains lundis franchissent l'année.
    const result = nextOccurrenceDates(1, 3, new Date("2026-12-28T10:00:00"));
    expect(result).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]);
  });
});
