import { describe, it, expect } from "vitest";
import { computeTopScore, type RawStats } from "./top-score";

function makeStats(overrides: Partial<RawStats> = {}): RawStats {
  return {
    user_id: "user-1",
    trajets_proposes: 5,
    demandes_recues: 10,
    demandes_acceptees: 8,
    passagers_transportes: 8,
    km_detour_consenti: 10,
    median_minutes_reponse: 15,
    taux_acceptation: 0.8,
    ...overrides,
  };
}

describe("computeTopScore", () => {
  it("retourne un tableau vide si aucun conducteur eligible", () => {
    const result = computeTopScore([
      makeStats({ user_id: "a", passagers_transportes: 0 }),
      makeStats({ user_id: "b", passagers_transportes: 0 }),
    ]);
    expect(result).toEqual([]);
  });

  it("retourne un seul conducteur avec un score positif s'il est seul eligible", () => {
    const result = computeTopScore([makeStats({ user_id: "solo" })]);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe("solo");
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("exclut les conducteurs avec 0 passager transporte", () => {
    const result = computeTopScore([
      makeStats({ user_id: "eligible", passagers_transportes: 3 }),
      makeStats({ user_id: "exclu", passagers_transportes: 0 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe("eligible");
  });

  it("place A devant B quand A a plus de passagers transportes (toutes autres stats egales)", () => {
    const result = computeTopScore([
      makeStats({ user_id: "B", passagers_transportes: 1 }),
      makeStats({ user_id: "A", passagers_transportes: 10 }),
    ]);
    expect(result[0].user_id).toBe("A");
    expect(result[1].user_id).toBe("B");
  });

  it("place A devant B quand A a un plus grand detour consenti (sacrifice)", () => {
    const base = {
      passagers_transportes: 5,
      trajets_proposes: 5,
      demandes_recues: 5,
      demandes_acceptees: 5,
      taux_acceptation: 1,
      median_minutes_reponse: 10,
    };
    const result = computeTopScore([
      makeStats({ ...base, user_id: "B", km_detour_consenti: 0 }),
      makeStats({ ...base, user_id: "A", km_detour_consenti: 50 }),
    ]);
    expect(result[0].user_id).toBe("A");
    expect(result[1].user_id).toBe("B");
  });

  it("place A devant B quand A a un taux d'acceptation de 100% vs 50% (popularite)", () => {
    const base = {
      passagers_transportes: 5,
      trajets_proposes: 5,
      demandes_recues: 10,
      km_detour_consenti: 5,
      median_minutes_reponse: 10,
    };
    const result = computeTopScore([
      makeStats({ ...base, user_id: "B", demandes_acceptees: 5, taux_acceptation: 0.5 }),
      makeStats({ ...base, user_id: "A", demandes_acceptees: 10, taux_acceptation: 1.0 }),
    ]);
    expect(result[0].user_id).toBe("A");
    expect(result[1].user_id).toBe("B");
  });

  it("place A devant B quand A repond en 5 min vs B en 60 min (reactivite)", () => {
    const base = {
      passagers_transportes: 5,
      trajets_proposes: 5,
      demandes_recues: 5,
      demandes_acceptees: 5,
      taux_acceptation: 1,
      km_detour_consenti: 5,
    };
    const result = computeTopScore([
      makeStats({ ...base, user_id: "B", median_minutes_reponse: 60 }),
      makeStats({ ...base, user_id: "A", median_minutes_reponse: 5 }),
    ]);
    expect(result[0].user_id).toBe("A");
    expect(result[1].user_id).toBe("B");
  });

  it("trie par score descendant", () => {
    const result = computeTopScore([
      makeStats({ user_id: "low", passagers_transportes: 1 }),
      makeStats({ user_id: "high", passagers_transportes: 20 }),
      makeStats({ user_id: "mid", passagers_transportes: 10 }),
    ]);
    const scores = result.map((r) => r.score);
    expect(scores[0]).toBeGreaterThanOrEqual(scores[1]);
    expect(scores[1]).toBeGreaterThanOrEqual(scores[2]);
  });

  it("ne crash pas quand toutes les stats optionnelles sont null", () => {
    const result = computeTopScore([
      makeStats({
        user_id: "nulls",
        passagers_transportes: 1,
        median_minutes_reponse: null,
        taux_acceptation: null,
        km_detour_consenti: 0,
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].score).toBeLessThanOrEqual(1);
  });

  it("retourne les proprietes originales (spread) en plus du score", () => {
    const stats = makeStats({ user_id: "check" });
    const result = computeTopScore([stats]);
    const row = result[0];
    expect(row.user_id).toBe("check");
    expect(row.trajets_proposes).toBe(stats.trajets_proposes);
    expect(row.passagers_transportes).toBe(stats.passagers_transportes);
    expect("score" in row).toBe(true);
  });

  it("score est entre 0 et 1 pour tous les conducteurs", () => {
    const rows = [
      makeStats({ user_id: "a", passagers_transportes: 5, km_detour_consenti: 0, median_minutes_reponse: null, taux_acceptation: 0 }),
      makeStats({ user_id: "b", passagers_transportes: 10, km_detour_consenti: 100, median_minutes_reponse: 2, taux_acceptation: 1 }),
      makeStats({ user_id: "c", passagers_transportes: 1, km_detour_consenti: 5, median_minutes_reponse: 30, taux_acceptation: 0.5 }),
    ];
    const result = computeTopScore(rows);
    for (const r of result) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });
});
