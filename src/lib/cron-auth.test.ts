import { describe, it, expect } from "vitest";
import { isValidCronAuth } from "./cron-auth";

describe("isValidCronAuth", () => {
  it("accepte un Bearer token strictement égal au secret", () => {
    expect(isValidCronAuth("Bearer s3cr3t", "s3cr3t")).toBe(true);
  });

  it("refuse si le secret d'environnement est absent (mal configuré)", () => {
    expect(isValidCronAuth("Bearer s3cr3t", undefined)).toBe(false);
    expect(isValidCronAuth("Bearer s3cr3t", "")).toBe(false);
  });

  it("refuse si l'en-tête Authorization est absent", () => {
    expect(isValidCronAuth(null, "s3cr3t")).toBe(false);
    expect(isValidCronAuth(undefined, "s3cr3t")).toBe(false);
    expect(isValidCronAuth("", "s3cr3t")).toBe(false);
  });

  it("refuse un token qui ne correspond pas", () => {
    expect(isValidCronAuth("Bearer wrong", "s3cr3t")).toBe(false);
  });

  it("refuse sans le schéma Bearer", () => {
    expect(isValidCronAuth("s3cr3t", "s3cr3t")).toBe(false);
    expect(isValidCronAuth("Basic s3cr3t", "s3cr3t")).toBe(false);
  });

  it("est sensible à la casse du schéma et aux espaces", () => {
    expect(isValidCronAuth("bearer s3cr3t", "s3cr3t")).toBe(false);
    expect(isValidCronAuth("Bearer  s3cr3t", "s3cr3t")).toBe(false);
    expect(isValidCronAuth("Bearer s3cr3t ", "s3cr3t")).toBe(false);
  });
});
