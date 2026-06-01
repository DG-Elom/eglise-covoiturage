import { describe, it, expect } from "vitest";
import { personalize, hasPrenomToken } from "./personalize";

describe("hasPrenomToken", () => {
  it("détecte {prénom} et {prenom}", () => {
    expect(hasPrenomToken("Bonjour {prénom} !")).toBe(true);
    expect(hasPrenomToken("Salut {prenom}")).toBe(true);
    expect(hasPrenomToken("Bonjour {Prénom}")).toBe(true);
  });
  it("faux si pas de jeton", () => {
    expect(hasPrenomToken("Bonjour à tous")).toBe(false);
  });
});

describe("personalize", () => {
  it("remplace le jeton par le prénom (toutes variantes)", () => {
    expect(personalize("Bonjour {prénom} !", "Awa")).toBe("Bonjour Awa !");
    expect(personalize("Salut {prenom}", "Marc")).toBe("Salut Marc");
    expect(personalize("Coucou {Prénom}", "Lucie")).toBe("Coucou Lucie");
  });
  it("remplace plusieurs occurrences", () => {
    expect(personalize("{prénom}, on compte sur toi {prénom} !", "Jean")).toBe(
      "Jean, on compte sur toi Jean !",
    );
  });
  it("laisse le message intact sans jeton", () => {
    expect(personalize("Rappel : culte dimanche 10h", "Awa")).toBe(
      "Rappel : culte dimanche 10h",
    );
  });
  it("retire proprement le jeton si le prénom est vide", () => {
    expect(personalize("Bonjour {prénom} !", "")).toBe("Bonjour !");
    expect(personalize("{prénom} bienvenue", "   ")).toBe("bienvenue");
  });
  it("trim le prénom", () => {
    expect(personalize("Salut {prenom}", "  Awa  ")).toBe("Salut Awa");
  });
  it("ne réinterprète pas les motifs $ dans un prénom", () => {
    expect(personalize("Salut {prenom}", "Jean$1")).toBe("Salut Jean$1");
    expect(personalize("Coucou {prénom}", "A$&B")).toBe("Coucou A$&B");
  });
});
