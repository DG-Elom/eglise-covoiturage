import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("autorise jusqu'à `max` requêtes dans la fenêtre", () => {
    const check = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(check("user-a", 0)).toBe(true);
    expect(check("user-a", 0)).toBe(true);
    expect(check("user-a", 0)).toBe(true);
  });

  it("bloque la (max+1)e requête dans la fenêtre", () => {
    const check = createRateLimiter({ max: 3, windowMs: 60_000 });
    check("user-a", 0);
    check("user-a", 0);
    check("user-a", 0);
    expect(check("user-a", 0)).toBe(false);
  });

  it("réinitialise le compteur une fois la fenêtre écoulée", () => {
    const check = createRateLimiter({ max: 2, windowMs: 60_000 });
    check("user-a", 0);
    check("user-a", 0);
    expect(check("user-a", 0)).toBe(false);
    // dernier ms de la fenêtre : toujours bloqué (borne now < resetAt)
    expect(check("user-a", 59_999)).toBe(false);
    // fenêtre écoulée (now >= resetAt)
    expect(check("user-a", 60_000)).toBe(true);
  });

  it("isole les compteurs par clé (userId)", () => {
    const check = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(check("user-a", 0)).toBe(true);
    expect(check("user-a", 0)).toBe(false);
    // un autre user n'est pas affecté
    expect(check("user-b", 0)).toBe(true);
  });

  it("isole les compteurs entre limiteurs distincts", () => {
    const checkA = createRateLimiter({ max: 1, windowMs: 60_000 });
    const checkB = createRateLimiter({ max: 1, windowMs: 60_000 });
    expect(checkA("user-a", 0)).toBe(true);
    expect(checkA("user-a", 0)).toBe(false);
    // checkB a son propre bucket
    expect(checkB("user-a", 0)).toBe(true);
  });
});
