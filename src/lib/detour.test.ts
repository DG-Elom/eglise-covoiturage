import { describe, it, expect } from "vitest";
import { kmToMinutes, formatDetour, formatDetourLong } from "./detour";

describe("kmToMinutes", () => {
  it("returns 0 for zero", () => {
    expect(kmToMinutes(0)).toBe(0);
  });

  it("returns 0 for negative", () => {
    expect(kmToMinutes(-1)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(kmToMinutes(NaN)).toBe(0);
  });

  it("returns 0 for Infinity", () => {
    expect(kmToMinutes(Infinity)).toBe(0);
  });

  it("rounds 0.4 km to 1 minute (0.4 * 2.4 = 0.96 → 1)", () => {
    expect(kmToMinutes(0.4)).toBe(1);
  });

  it("rounds 1 km to 2 minutes (1 * 2.4 = 2.4 → 2)", () => {
    expect(kmToMinutes(1)).toBe(2);
  });

  it("rounds 5 km to 12 minutes (5 * 2.4 = 12)", () => {
    expect(kmToMinutes(5)).toBe(12);
  });

  it("rounds 10 km to 24 minutes (10 * 2.4 = 24)", () => {
    expect(kmToMinutes(10)).toBe(24);
  });
});

describe("formatDetour", () => {
  it("returns '0 km' for zero", () => {
    expect(formatDetour(0)).toBe("0 km");
  });

  it("returns '0 km' for negative", () => {
    expect(formatDetour(-5)).toBe("0 km");
  });

  it("returns '0 km' for NaN", () => {
    expect(formatDetour(NaN)).toBe("0 km");
  });

  it("uses 'moins d'1 min' when minutes rounds to 0", () => {
    // 0.2 km * 2.4 = 0.48 → rounds to 0
    expect(formatDetour(0.2)).toBe("0.2 km · moins d'1 min");
  });

  it("formats 1 km correctly", () => {
    expect(formatDetour(1)).toBe("1 km · ~2 min");
  });

  it("formats 5 km correctly", () => {
    expect(formatDetour(5)).toBe("5 km · ~12 min");
  });

  it("formats 10 km correctly", () => {
    expect(formatDetour(10)).toBe("10 km · ~24 min");
  });

  it("strips trailing .0 for round values", () => {
    expect(formatDetour(3)).toContain("3 km");
    expect(formatDetour(3)).not.toContain("3.0 km");
  });

  it("keeps decimal for non-round values", () => {
    expect(formatDetour(1.2)).toBe("1.2 km · ~3 min");
  });
});

describe("formatDetourLong", () => {
  it("returns 'Aucun détour' for zero", () => {
    expect(formatDetourLong(0)).toBe("Aucun détour");
  });

  it("returns 'Aucun détour' for negative", () => {
    expect(formatDetourLong(-1)).toBe("Aucun détour");
  });

  it("returns 'Aucun détour' for NaN", () => {
    expect(formatDetourLong(NaN)).toBe("Aucun détour");
  });

  it("returns just km without minutes when minutes rounds to 0", () => {
    // 0.2 km * 2.4 = 0.48 → 0
    expect(formatDetourLong(0.2)).toBe("0.2 km de détour");
  });

  it("formats 1 km correctly", () => {
    expect(formatDetourLong(1)).toBe("1 km de détour (~2 min)");
  });

  it("formats 5 km correctly", () => {
    expect(formatDetourLong(5)).toBe("5 km de détour (~12 min)");
  });

  it("strips trailing .0 for round values", () => {
    expect(formatDetourLong(2)).toBe("2 km de détour (~5 min)");
    expect(formatDetourLong(2)).not.toContain("2.0 km");
  });

  it("keeps decimal for non-round values", () => {
    expect(formatDetourLong(2.5)).toBe("2.5 km de détour (~6 min)");
  });
});
