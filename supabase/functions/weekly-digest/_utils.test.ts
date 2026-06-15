import { describe, it, expect } from "vitest";
import {
  getIsoWeekKey,
  isoWeekNumber,
  chooseCta,
  buildSmsBody,
} from "./_utils";

describe("isoWeekNumber", () => {
  it("semaine 1 du 1er janvier 2026 (jour 4 ISO = jeudi)", () => {
    // 2026-01-01 est un jeudi = semaine ISO 1 de 2026
    const { year, week } = isoWeekNumber(new Date("2026-01-01"));
    expect(year).toBe(2026);
    expect(week).toBe(1);
  });

  it("2026-06-12 = semaine 24 de 2026", () => {
    const { year, week } = isoWeekNumber(new Date("2026-06-12"));
    expect(year).toBe(2026);
    expect(week).toBe(24);
  });

  it("2026-12-31 = semaine 53 de 2026 (ou semaine 1 de 2027)", () => {
    // 2026-12-31 est un jeudi, donc semaine 53 de 2026
    const { year, week } = isoWeekNumber(new Date("2026-12-31"));
    // La semaine ISO 53 existe si le 1er janvier de l'année N+1 est un vendredi ou samedi
    // 2027-01-01 est un vendredi → 2026 a une semaine 53
    expect(year).toBe(2026);
    expect(week).toBe(53);
  });

  it("2025-12-29 = semaine 1 de 2026", () => {
    // 2025-12-29 est un lundi appartenant à la semaine ISO 1 de 2026
    const { year, week } = isoWeekNumber(new Date("2025-12-29"));
    expect(year).toBe(2026);
    expect(week).toBe(1);
  });
});

describe("getIsoWeekKey", () => {
  it("format weekly_digest_YYYYWww", () => {
    const key = getIsoWeekKey(new Date("2026-06-12"));
    expect(key).toBe("weekly_digest_2026W24");
  });

  it("semaine < 10 est paddée avec un zéro", () => {
    const key = getIsoWeekKey(new Date("2026-01-01"));
    expect(key).toBe("weekly_digest_2026W01");
  });

  it("même date → même clé (idempotence)", () => {
    const date = new Date("2026-06-12");
    expect(getIsoWeekKey(date)).toBe(getIsoWeekKey(date));
  });
});

describe("chooseCta", () => {
  it("passager → url recherche", () => {
    const cta = chooseCta({ role: "passager", hasActiveTrajet: false });
    expect(cta.url).toBe("/trajets/recherche");
    expect(cta.label).toMatch(/réserv/i);
  });

  it("conducteur sans trajet actif → url nouveau trajet", () => {
    const cta = chooseCta({ role: "conducteur", hasActiveTrajet: false });
    expect(cta.url).toBe("/trajets/nouveau");
    expect(cta.label).toMatch(/trajet/i);
  });

  it("les_deux sans trajet actif → url nouveau trajet", () => {
    const cta = chooseCta({ role: "les_deux", hasActiveTrajet: false });
    expect(cta.url).toBe("/trajets/nouveau");
  });

  it("conducteur avec trajet actif → url dashboard", () => {
    const cta = chooseCta({ role: "conducteur", hasActiveTrajet: true });
    expect(cta.url).toBe("/dashboard");
    expect(cta.label).toMatch(/demand/i);
  });

  it("les_deux avec trajet actif → url dashboard", () => {
    const cta = chooseCta({ role: "les_deux", hasActiveTrajet: true });
    expect(cta.url).toBe("/dashboard");
  });
});

describe("buildSmsBody", () => {
  it("passager → message avec lien recherche, max 160 chars", () => {
    const body = buildSmsBody({
      prenom: "Marie",
      role: "passager",
      hasActiveTrajet: false,
      appUrl: "https://app.icc-covoit.fr",
      nbPlacesLibres: 5,
      nextDate: "2026-06-14",
    });
    expect(body).toContain("https://app.icc-covoit.fr/trajets/recherche");
    expect(body).toContain("Marie");
    expect(body).toContain("Réserve");
    expect(body).not.toMatch(/Rserve|Réserv\b/);
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("conducteur sans trajet → message avec lien nouveau trajet, max 160 chars", () => {
    const body = buildSmsBody({
      prenom: "Pierre",
      role: "conducteur",
      hasActiveTrajet: false,
      appUrl: "https://app.icc-covoit.fr",
      nbPlacesLibres: 3,
      nextDate: "2026-06-14",
    });
    expect(body).toContain("https://app.icc-covoit.fr/trajets/nouveau");
    expect(body).toContain("Pierre");
    expect(body).toContain("propose ton trajet");
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("conducteur avec trajet actif → message avec lien dashboard, max 160 chars", () => {
    const body = buildSmsBody({
      prenom: "Paul",
      role: "conducteur",
      hasActiveTrajet: true,
      appUrl: "https://app.icc-covoit.fr",
      nbPlacesLibres: 2,
      nextDate: "2026-06-14",
    });
    expect(body).toContain("https://app.icc-covoit.fr/dashboard");
    expect(body).toContain("Paul");
    expect(body).toContain("Vérifie");
    expect(body.length).toBeLessThanOrEqual(160);
  });

  it("prenom long ne dépasse pas 160 chars", () => {
    const body = buildSmsBody({
      prenom: "Barthélemy-Emmanuel",
      role: "passager",
      hasActiveTrajet: false,
      appUrl: "https://app.icc-covoit.fr",
      nbPlacesLibres: 10,
      nextDate: "2026-06-14",
    });
    expect(body.length).toBeLessThanOrEqual(160);
  });
});
