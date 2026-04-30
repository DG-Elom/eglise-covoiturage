import { describe, it, expect } from "vitest";
import { chooseEngageKind } from "./engagement";

describe("chooseEngageKind", () => {
  it("retourne null pour 1 jour (trop tôt)", () => {
    expect(chooseEngageKind(1)).toBeNull();
  });

  it("retourne engage_d2 pour 2 jours (borne basse)", () => {
    expect(chooseEngageKind(2)).toBe("engage_d2");
  });

  it("retourne engage_d2 pour 6 jours", () => {
    expect(chooseEngageKind(6)).toBe("engage_d2");
  });

  it("retourne engage_d7 pour 7 jours (borne basse)", () => {
    expect(chooseEngageKind(7)).toBe("engage_d7");
  });

  it("retourne engage_d7 pour 13 jours", () => {
    expect(chooseEngageKind(13)).toBe("engage_d7");
  });

  it("retourne engage_d14 pour 14 jours (borne basse)", () => {
    expect(chooseEngageKind(14)).toBe("engage_d14");
  });

  it("retourne engage_d14 pour 27 jours", () => {
    expect(chooseEngageKind(27)).toBe("engage_d14");
  });

  it("retourne null pour 28 jours (délai dépassé)", () => {
    expect(chooseEngageKind(28)).toBeNull();
  });

  it("retourne null pour 0 jour", () => {
    expect(chooseEngageKind(0)).toBeNull();
  });

  it("retourne null pour 100 jours", () => {
    expect(chooseEngageKind(100)).toBeNull();
  });
});
