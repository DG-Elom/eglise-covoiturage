import { describe, it, expect } from "vitest";
import { computeWeeklyStats, type WeeklyRawData } from "./_stats";

const makeRaw = (overrides: Partial<WeeklyRawData> = {}): WeeklyRawData => ({
  trajetsEffectues: 0,
  passagersTransportes: 0,
  nouveauxInscrits: 0,
  messagesEchanges: 0,
  kmCumules: 0,
  ...overrides,
});

describe("computeWeeklyStats", () => {
  it("calcule le CO2 estimé à partir des km et passagers", () => {
    // 100 km × 0.12 kg/passager × 4 passagers = 48 kg
    const stats = computeWeeklyStats(
      makeRaw({ kmCumules: 100, passagersTransportes: 4 }),
    );
    expect(stats.co2EconomiseKg).toBeCloseTo(48, 5);
  });

  it("retourne 0 CO2 si pas de km", () => {
    const stats = computeWeeklyStats(makeRaw({ kmCumules: 0, passagersTransportes: 5 }));
    expect(stats.co2EconomiseKg).toBe(0);
  });

  it("retourne 0 CO2 si pas de passagers", () => {
    const stats = computeWeeklyStats(makeRaw({ kmCumules: 100, passagersTransportes: 0 }));
    expect(stats.co2EconomiseKg).toBe(0);
  });

  it("passe les autres champs tel quels", () => {
    const raw = makeRaw({
      trajetsEffectues: 12,
      passagersTransportes: 34,
      nouveauxInscrits: 5,
      messagesEchanges: 88,
      kmCumules: 250,
    });
    const stats = computeWeeklyStats(raw);
    expect(stats.trajetsEffectues).toBe(12);
    expect(stats.passagersTransportes).toBe(34);
    expect(stats.nouveauxInscrits).toBe(5);
    expect(stats.messagesEchanges).toBe(88);
    expect(stats.kmCumules).toBe(250);
  });

  it("arrondit le CO2 à 2 décimales", () => {
    // 1 km × 0.12 × 3 passagers = 0.36
    const stats = computeWeeklyStats(
      makeRaw({ kmCumules: 1, passagersTransportes: 3 }),
    );
    expect(stats.co2EconomiseKg).toBe(0.36);
  });
});
