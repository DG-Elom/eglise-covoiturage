// @vitest-environment node
import { describe, it, expect } from "vitest";
import { validateThanksMessage } from "./thanks-validators";

describe("validateThanksMessage", () => {
  it("accepte un message d'exactement 1 caractère", () => {
    const result = validateThanksMessage("A");
    expect(result.ok).toBe(true);
  });

  it("accepte un message d'exactement 500 caractères", () => {
    const message = "a".repeat(500);
    const result = validateThanksMessage(message);
    expect(result.ok).toBe(true);
  });

  it("rejette un message vide", () => {
    const result = validateThanksMessage("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("message_too_short");
  });

  it("rejette un message de 501 caractères", () => {
    const message = "a".repeat(501);
    const result = validateThanksMessage(message);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("message_too_long");
  });

  it("rejette un message uniquement composé d'espaces", () => {
    const result = validateThanksMessage("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("message_too_short");
  });

  it("accepte un message avec des espaces mais contenu suffisant", () => {
    const result = validateThanksMessage("  Merci beaucoup !  ");
    expect(result.ok).toBe(true);
  });
});
