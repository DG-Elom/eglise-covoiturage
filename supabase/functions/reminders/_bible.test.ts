import { describe, it, expect } from "vitest";
import { getDailyVerse } from "./_bible";

describe("getDailyVerse", () => {
  it("retourne un objet avec reference et texte non vides", () => {
    const verset = getDailyVerse(new Date("2024-01-15"));
    expect(verset.reference).toBeTruthy();
    expect(verset.texte).toBeTruthy();
  });

  it("même date → même verset (déterminisme)", () => {
    const date = new Date("2024-06-21");
    const v1 = getDailyVerse(date);
    const v2 = getDailyVerse(date);
    expect(v1.reference).toBe(v2.reference);
    expect(v1.texte).toBe(v2.texte);
  });

  it("des dates différentes produisent des versets différents (rotation)", () => {
    const references = new Set<string>();
    // On parcourt 50 jours consécutifs pour vérifier la rotation
    for (let i = 0; i < 50; i++) {
      const date = new Date(2024, 0, 1 + i);
      references.add(getDailyVerse(date).reference);
    }
    // Avec 50 versets et 50 jours, on doit couvrir toute la liste
    expect(references.size).toBe(50);
  });

  it("aucun verset avec texte vide dans la liste", () => {
    for (let i = 0; i < 366; i++) {
      const date = new Date(2024, 0, 1);
      date.setDate(date.getDate() + i);
      const v = getDailyVerse(date);
      expect(v.texte.trim().length).toBeGreaterThan(0);
      expect(v.reference.trim().length).toBeGreaterThan(0);
    }
  });
});
