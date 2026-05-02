import { describe, it, expect } from "vitest";
import { computeAcceptanceRate, parseDetourRpcResult } from "./trajet-stats";

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

describe("parseDetourRpcResult", () => {
  it("returns null when rpc data is null", () => {
    expect(parseDetourRpcResult(null)).toBeNull();
  });

  it("returns null when rpc data is undefined", () => {
    expect(parseDetourRpcResult(undefined)).toBeNull();
  });

  it("converts numeric string to number", () => {
    expect(parseDetourRpcResult("1.23")).toBe(1.23);
  });

  it("converts number to number", () => {
    expect(parseDetourRpcResult(2.5)).toBe(2.5);
  });

  it("converts integer to number", () => {
    expect(parseDetourRpcResult(3)).toBe(3);
  });

  it("returns null for NaN-producing input", () => {
    expect(parseDetourRpcResult("not-a-number")).toBeNull();
  });
});
