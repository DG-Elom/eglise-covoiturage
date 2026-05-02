import { describe, it, expect } from "vitest";
import { computeAcceptanceRate } from "./trajet-stats";

describe("computeAcceptanceRate", () => {
  it("returns null when both accepted and refused are 0", () => {
    expect(computeAcceptanceRate(0, 0)).toBeNull();
  });

  it("returns 1 when all demandes are accepted (refused = 0)", () => {
    expect(computeAcceptanceRate(10, 0)).toBe(1);
  });

  it("returns 0.5 for equal accepted and refused", () => {
    expect(computeAcceptanceRate(5, 5)).toBe(0.5);
  });

  it("returns 0 when none accepted", () => {
    expect(computeAcceptanceRate(0, 3)).toBe(0);
  });

  it("computes rate for general case", () => {
    expect(computeAcceptanceRate(3, 1)).toBe(0.75);
  });
});
