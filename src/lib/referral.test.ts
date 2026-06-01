import { describe, it, expect } from "vitest";
import {
  generateReferralCode,
  isValidReferralCode,
  buildReferralLink,
  buildReferralMessage,
  buildWhatsAppShareUrl,
  isAmbassadeur,
  extractReferralCodeFromUrl,
  REFERRAL_BASE_URL,
} from "./referral";

describe("generateReferralCode", () => {
  it("produit un code de 8 caractères", () => {
    expect(generateReferralCode()).toHaveLength(8);
  });

  it("n'utilise jamais de caractères ambigus (O,0,I,1,L)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode();
      expect(code).not.toMatch(/[O0I1L]/);
    }
  });

  it("est déterministe avec un rng injecté", () => {
    const rng = () => 0; // toujours le premier caractère de l'alphabet
    expect(generateReferralCode(rng)).toBe("AAAAAAAA");
  });

  it("génère un code valide selon isValidReferralCode", () => {
    expect(isValidReferralCode(generateReferralCode())).toBe(true);
  });
});

describe("isValidReferralCode", () => {
  it("rejette une longueur incorrecte", () => {
    expect(isValidReferralCode("ABC")).toBe(false);
    expect(isValidReferralCode("ABCDEFGHI")).toBe(false);
  });

  it("rejette les caractères hors alphabet", () => {
    expect(isValidReferralCode("ABCDEFG0")).toBe(false); // 0 interdit
    expect(isValidReferralCode("abcdefgh")).toBe(false); // minuscules interdites
  });

  it("accepte un code conforme", () => {
    expect(isValidReferralCode("ABCDEFGH")).toBe(true);
  });
});

describe("buildReferralLink", () => {
  it("construit le lien avec le ref encodé", () => {
    expect(buildReferralLink("ABCD2345")).toBe(
      `${REFERRAL_BASE_URL}/?ref=ABCD2345`,
    );
  });

  it("utilise la base par défaut app.icc-covoit.fr", () => {
    expect(buildReferralLink("XYZ")).toContain("https://app.icc-covoit.fr/?ref=");
  });

  it("ne double pas le slash si la base finit déjà par /", () => {
    expect(buildReferralLink("ABCD2345", "https://app.icc-covoit.fr/")).toBe(
      "https://app.icc-covoit.fr/?ref=ABCD2345",
    );
  });

  it("encode les caractères spéciaux", () => {
    expect(buildReferralLink("A B")).toContain("ref=A%20B");
  });
});

describe("buildReferralMessage", () => {
  it("personnalise avec le prénom du parrain", () => {
    const msg = buildReferralMessage("https://x/?ref=Y", "David");
    expect(msg).toContain("David t'invite");
    expect(msg).toContain("https://x/?ref=Y");
  });

  it("a un fallback sans prénom", () => {
    const msg = buildReferralMessage("https://x/?ref=Y");
    expect(msg).toContain("Rejoins-nous");
    expect(msg).not.toContain("undefined");
  });

  it("ignore un prénom vide ou espaces", () => {
    expect(buildReferralMessage("L", "   ")).toContain("Rejoins-nous");
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("crée un lien wa.me avec le texte encodé", () => {
    const url = buildWhatsAppShareUrl("Salut & bienvenue");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).toContain("Salut%20%26%20bienvenue");
  });
});

describe("isAmbassadeur", () => {
  it("faux à zéro parrainage", () => {
    expect(isAmbassadeur(0)).toBe(false);
  });

  it("vrai dès un parrainage réussi", () => {
    expect(isAmbassadeur(1)).toBe(true);
    expect(isAmbassadeur(5)).toBe(true);
  });
});

describe("extractReferralCodeFromUrl", () => {
  it("extrait un code valide", () => {
    expect(
      extractReferralCodeFromUrl("https://app.icc-covoit.fr/?ref=ABCD2345"),
    ).toBe("ABCD2345");
  });

  it("renvoie null si pas de ref", () => {
    expect(extractReferralCodeFromUrl("https://app.icc-covoit.fr/")).toBeNull();
  });

  it("renvoie null si ref invalide", () => {
    expect(
      extractReferralCodeFromUrl("https://app.icc-covoit.fr/?ref=bad"),
    ).toBeNull();
  });

  it("renvoie null sur une URL malformée", () => {
    expect(extractReferralCodeFromUrl("pas-une-url")).toBeNull();
  });
});
