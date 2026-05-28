import { describe, it, expect } from "vitest";
import { deduplicateRecentAddresses } from "../recent-addresses";

const rows = [
  { pickup_adresse: "1 rue de la Paix, Metz" },
  { pickup_adresse: "2 avenue Foch, Metz" },
  { pickup_adresse: "1 rue de la Paix, Metz" }, // duplicate
  { pickup_adresse: "3 boulevard Poincaré, Metz" },
  { pickup_adresse: "4 rue Serpenoise, Metz" },
  { pickup_adresse: "5 place de la République, Metz" },
  { pickup_adresse: "6 rue des Clercs, Metz" },
];

describe("deduplicateRecentAddresses", () => {
  it("retourne au maximum 5 éléments par défaut", () => {
    expect(deduplicateRecentAddresses(rows)).toHaveLength(5);
  });

  it("préserve l'ordre d'apparition (première occurrence)", () => {
    const result = deduplicateRecentAddresses(rows);
    expect(result[0]).toBe("1 rue de la Paix, Metz");
    expect(result[1]).toBe("2 avenue Foch, Metz");
  });

  it("élimine les doublons", () => {
    const result = deduplicateRecentAddresses(rows);
    expect(new Set(result).size).toBe(result.length);
  });

  it("retourne un tableau vide pour une entrée vide", () => {
    expect(deduplicateRecentAddresses([])).toEqual([]);
  });

  it("respecte la limite personnalisée", () => {
    expect(deduplicateRecentAddresses(rows, 3)).toHaveLength(3);
  });

  it("ignore les adresses vides / falsy", () => {
    const input = [{ pickup_adresse: "" }, { pickup_adresse: "valid address" }];
    const result = deduplicateRecentAddresses(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("valid address");
  });
});
