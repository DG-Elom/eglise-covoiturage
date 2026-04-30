import { describe, it, expect } from "vitest";
import { roundCoords } from "./geo-privacy";

describe("roundCoords", () => {
  it("arrondit lat et lng à 3 décimales par défaut", () => {
    const result = roundCoords(49.146943, 6.175955);
    expect(result.lat).toBe(49.147);
    expect(result.lng).toBe(6.176);
  });

  it("arrondit à la précision spécifiée", () => {
    const result = roundCoords(49.146943, 6.175955, 2);
    expect(result.lat).toBe(49.15);
    expect(result.lng).toBe(6.18);
  });

  it("précision 4 donne 4 décimales", () => {
    const result = roundCoords(49.146943, 6.175955, 4);
    expect(result.lat).toBe(49.1469);
    expect(result.lng).toBe(6.176);
  });

  it("gère des coordonnées négatives", () => {
    const result = roundCoords(-33.868820, 151.209296);
    expect(result.lat).toBe(-33.869);
    expect(result.lng).toBe(151.209);
  });

  it("retourne des nombres, pas des strings", () => {
    const result = roundCoords(49.146943, 6.175955);
    expect(typeof result.lat).toBe("number");
    expect(typeof result.lng).toBe("number");
  });

  it("précision 0 arrondit à l'entier", () => {
    const result = roundCoords(49.7, 6.2, 0);
    expect(result.lat).toBe(50);
    expect(result.lng).toBe(6);
  });
});
