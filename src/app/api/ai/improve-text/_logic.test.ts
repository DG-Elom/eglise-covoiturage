import { describe, it, expect } from "vitest";
import { validateImproveTextInput, buildImproveTextPrompt, type ImproveTextContext } from "./_logic";

describe("validateImproveTextInput", () => {
  it("accepte un input valide", () => {
    const result = validateImproveTextInput({ text: "Bonjour monde", context: "bio" });
    expect(result.ok).toBe(true);
  });

  it("rejette un texte vide", () => {
    const result = validateImproveTextInput({ text: "", context: "bio" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeDefined();
  });

  it("rejette un texte de plus de 500 caractères", () => {
    const long = "a".repeat(501);
    const result = validateImproveTextInput({ text: long, context: "bio" });
    expect(result.ok).toBe(false);
  });

  it("rejette un contexte invalide", () => {
    const result = validateImproveTextInput({ text: "Bonjour", context: "invalid" as ImproveTextContext });
    expect(result.ok).toBe(false);
  });

  it("accepte tous les contextes valides", () => {
    const contexts: ImproveTextContext[] = ["bio", "annulation", "thanks", "message"];
    for (const ctx of contexts) {
      const result = validateImproveTextInput({ text: "texte test", context: ctx });
      expect(result.ok).toBe(true);
    }
  });
});

describe("buildImproveTextPrompt", () => {
  it("inclut le texte original dans le prompt", () => {
    const prompt = buildImproveTextPrompt("Mon texte perso", "bio");
    expect(prompt).toContain("Mon texte perso");
  });

  it("adapte le prompt selon le contexte bio", () => {
    const prompt = buildImproveTextPrompt("test", "bio");
    expect(prompt.toLowerCase()).toContain("bio");
  });

  it("le prompt bio mentionne la limite de 280 caractères", () => {
    const prompt = buildImproveTextPrompt("test", "bio");
    expect(prompt).toContain("280");
  });

  it("le prompt bio demande la première personne", () => {
    const prompt = buildImproveTextPrompt("test", "bio");
    expect(prompt.toLowerCase()).toMatch(/première personne|1ère personne/);
  });

  it("le prompt bio demande un ton chaleureux pour rassurer les passagers", () => {
    const prompt = buildImproveTextPrompt("test", "bio");
    expect(prompt.toLowerCase()).toMatch(/chaleur|passager/);
  });

  it("adapte le prompt selon le contexte annulation", () => {
    const prompt = buildImproveTextPrompt("test", "annulation");
    expect(prompt.toLowerCase()).toContain("annulat");
  });

  it("adapte le prompt selon le contexte thanks", () => {
    const prompt = buildImproveTextPrompt("test", "thanks");
    expect(prompt.toLowerCase()).toMatch(/merci|remerci/);
  });

  it("adapte le prompt selon le contexte message", () => {
    const prompt = buildImproveTextPrompt("test", "message");
    expect(prompt.toLowerCase()).toContain("message");
  });
});
