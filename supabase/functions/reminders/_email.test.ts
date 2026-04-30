import { describe, it, expect } from "vitest";
import { renderConducteurEmail, renderPassagerEmail } from "./_email";
import type { Verset } from "./_email";

const verset: Verset = {
  reference: "Proverbes 17:17",
  // Texte sans apostrophe pour éviter le problème d'escapeHtml (&#39;)
  texte: "Le fer aiguise le fer, et le sage aiguise son ami.",
};

describe("renderConducteurEmail avec verset", () => {
  it("inclut le texte du verset dans le HTML", () => {
    const { html } = renderConducteurEmail(
      {
        prenom: "Paul",
        programme: "Culte du dimanche",
        date: "2024-06-16",
        heureDepart: "09:30",
        passagers: [],
      },
      verset,
    );
    expect(html).toContain(verset.texte);
  });

  it("inclut la référence du verset dans le HTML", () => {
    const { html } = renderConducteurEmail(
      {
        prenom: "Paul",
        programme: "Culte du dimanche",
        date: "2024-06-16",
        heureDepart: "09:30",
        passagers: [],
      },
      verset,
    );
    expect(html).toContain(verset.reference);
  });

  it("contient le style de l'encart vert", () => {
    const { html } = renderConducteurEmail(
      {
        prenom: "Paul",
        programme: "Culte du dimanche",
        date: "2024-06-16",
        heureDepart: "09:30",
        passagers: [],
      },
      verset,
    );
    expect(html).toContain("background:#f0fdf4");
  });
});

describe("renderPassagerEmail avec verset", () => {
  it("inclut le texte du verset dans le HTML", () => {
    const { html } = renderPassagerEmail(
      {
        prenom: "Marie",
        conducteurPrenom: "Paul",
        conducteurNom: "Martin",
        programme: "Culte du dimanche",
        date: "2024-06-16",
        heureDepart: "09:30",
        pickupAdresse: "12 rue de la Paix",
        voitureModele: "Clio",
        voitureCouleur: "blanche",
        conducteurTelephone: "06 12 34 56 78",
      },
      verset,
    );
    expect(html).toContain(verset.texte);
  });

  it("inclut la référence du verset dans le HTML", () => {
    const { html } = renderPassagerEmail(
      {
        prenom: "Marie",
        conducteurPrenom: "Paul",
        conducteurNom: "Martin",
        programme: "Culte du dimanche",
        date: "2024-06-16",
        heureDepart: "09:30",
        pickupAdresse: "12 rue de la Paix",
        voitureModele: null,
        voitureCouleur: null,
        conducteurTelephone: "06 12 34 56 78",
      },
      verset,
    );
    expect(html).toContain(verset.reference);
  });
});
