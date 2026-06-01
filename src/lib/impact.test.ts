import { describe, it, expect } from "vitest";
import {
  aggregateImpactRows,
  computeImpactStats,
  computeImpactFromRows,
  formatImpactShareText,
  type ImpactRawData,
  type ImpactRawRows,
} from "./impact";

const makeRaw = (overrides: Partial<ImpactRawData> = {}): ImpactRawData => ({
  trajetsEffectues: 0,
  passagersTransportes: 0,
  nouveauxInscrits: 0,
  messagesEchanges: 0,
  kmCumules: 0,
  ...overrides,
});

describe("computeImpactStats", () => {
  it("calcule le CO2 estimé à partir des km et passagers", () => {
    // 100 km × 0.12 kg/passager × 4 passagers = 48 kg
    const stats = computeImpactStats(
      makeRaw({ kmCumules: 100, passagersTransportes: 4 }),
    );
    expect(stats.co2EconomiseKg).toBeCloseTo(48, 5);
  });

  it("retourne 0 CO2 si pas de km", () => {
    expect(
      computeImpactStats(makeRaw({ kmCumules: 0, passagersTransportes: 5 }))
        .co2EconomiseKg,
    ).toBe(0);
  });

  it("retourne 0 CO2 si pas de passagers", () => {
    expect(
      computeImpactStats(makeRaw({ kmCumules: 100, passagersTransportes: 0 }))
        .co2EconomiseKg,
    ).toBe(0);
  });

  it("arrondit le CO2 à 2 décimales", () => {
    // 1 km × 0.12 × 3 passagers = 0.36
    const stats = computeImpactStats(
      makeRaw({ kmCumules: 1, passagersTransportes: 3 }),
    );
    expect(stats.co2EconomiseKg).toBe(0.36);
  });

  it("passe les compteurs tel quels", () => {
    const stats = computeImpactStats(
      makeRaw({
        trajetsEffectues: 12,
        passagersTransportes: 34,
        nouveauxInscrits: 5,
        messagesEchanges: 88,
        kmCumules: 250,
      }),
    );
    expect(stats.trajetsEffectues).toBe(12);
    expect(stats.passagersTransportes).toBe(34);
    expect(stats.nouveauxInscrits).toBe(5);
    expect(stats.messagesEchanges).toBe(88);
    expect(stats.kmCumules).toBe(250);
  });
});

describe("aggregateImpactRows", () => {
  const sampleRows: ImpactRawRows = {
    trajetsInstances: [
      { annule_par_conducteur: false },
      { annule_par_conducteur: false },
      { annule_par_conducteur: true }, // exclu
      { annule_par_conducteur: null }, // compté (non explicitement annulé)
    ],
    reservations: [
      { statut: "completed" },
      { statut: "completed" },
      { statut: "accepted" }, // exclu
      { statut: "cancelled" }, // exclu
      { statut: null }, // exclu
    ],
    nouveauxProfils: 7,
    messages: 42,
  };

  it("compte les trajets effectués (instances non annulées)", () => {
    expect(aggregateImpactRows(sampleRows).trajetsEffectues).toBe(3);
  });

  it("compte les passagers transportés (réservations completed)", () => {
    expect(aggregateImpactRows(sampleRows).passagersTransportes).toBe(2);
  });

  it("dérive les km cumulés (trajets × 20)", () => {
    expect(aggregateImpactRows(sampleRows).kmCumules).toBe(60);
  });

  it("reprend nouveaux inscrits et messages", () => {
    const agg = aggregateImpactRows(sampleRows);
    expect(agg.nouveauxInscrits).toBe(7);
    expect(agg.messagesEchanges).toBe(42);
  });

  it("plancher à 0 pour des compteurs négatifs ou non entiers", () => {
    const agg = aggregateImpactRows({
      trajetsInstances: [],
      reservations: [],
      nouveauxProfils: -3,
      messages: 4.9,
    });
    expect(agg.nouveauxInscrits).toBe(0);
    expect(agg.messagesEchanges).toBe(4);
  });

  it("retourne des zéros pour des listes vides", () => {
    const agg = aggregateImpactRows({
      trajetsInstances: [],
      reservations: [],
      nouveauxProfils: 0,
      messages: 0,
    });
    expect(agg.trajetsEffectues).toBe(0);
    expect(agg.passagersTransportes).toBe(0);
    expect(agg.kmCumules).toBe(0);
  });
});

describe("computeImpactFromRows", () => {
  it("enchaîne agrégation + CO2 sur des données d'exemple", () => {
    const stats = computeImpactFromRows({
      trajetsInstances: [
        { annule_par_conducteur: false },
        { annule_par_conducteur: false },
      ],
      reservations: [{ statut: "completed" }, { statut: "completed" }],
      nouveauxProfils: 3,
      messages: 15,
    });
    // 2 trajets → 40 km ; 40 × 0.12 × 2 = 9.6 kg CO2
    expect(stats.trajetsEffectues).toBe(2);
    expect(stats.passagersTransportes).toBe(2);
    expect(stats.kmCumules).toBe(40);
    expect(stats.co2EconomiseKg).toBe(9.6);
  });
});

describe("formatImpactShareText", () => {
  it("formate la phrase de partage avec arrondis entiers", () => {
    const text = formatImpactShareText({
      trajetsEffectues: 42,
      passagersTransportes: 18,
      nouveauxInscrits: 4,
      messagesEchanges: 100,
      kmCumules: 230,
      co2EconomiseKg: 31.4,
    });
    expect(text).toBe(
      "Ce mois : 42 trajets · 18 personnes · 230 km partagés · 31 kg CO2 évités 🌱",
    );
  });
});
