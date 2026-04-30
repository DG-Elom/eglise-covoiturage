import { describe, it, expect } from "vitest";
import { shouldUpsert } from "./track-throttle";

const THROTTLE_MS = 10_000;

describe("shouldUpsert", () => {
  it("retourne true quand lastTs est null (premier appel)", () => {
    expect(shouldUpsert(null, Date.now(), THROTTLE_MS)).toBe(true);
  });

  it("retourne true quand le délai est écoulé", () => {
    const lastTs = Date.now() - THROTTLE_MS - 1;
    expect(shouldUpsert(lastTs, Date.now(), THROTTLE_MS)).toBe(true);
  });

  it("retourne false quand le délai n'est pas encore écoulé", () => {
    const now = Date.now();
    const lastTs = now - THROTTLE_MS + 1000;
    expect(shouldUpsert(lastTs, now, THROTTLE_MS)).toBe(false);
  });

  it("retourne false quand le délai est exactement 0 (même timestamp)", () => {
    const now = Date.now();
    expect(shouldUpsert(now, now, THROTTLE_MS)).toBe(false);
  });

  it("retourne true quand le délai est exactement atteint", () => {
    const now = Date.now();
    const lastTs = now - THROTTLE_MS;
    expect(shouldUpsert(lastTs, now, THROTTLE_MS)).toBe(true);
  });
});
