import { describe, it, expect } from "vitest";
import { validatePickupPosition } from "./subscription-pickup";

describe("validatePickupPosition", () => {
  it("accepte une position valide", () => {
    const result = validatePickupPosition({ lat: 48.85, lng: 2.35 });
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("refuse lat=0 lng=0 (null island)", () => {
    const result = validatePickupPosition({ lat: 0, lng: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pickup_position_null_island");
  });

  it("refuse lat très proche de 0 et lng très proche de 0 (dans les 0.01 degrés)", () => {
    const result = validatePickupPosition({ lat: 0.005, lng: 0.008 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pickup_position_null_island");
  });

  it("accepte une position avec lat=0 mais lng significatif", () => {
    const result = validatePickupPosition({ lat: 0, lng: 10 });
    expect(result.ok).toBe(true);
  });

  it("accepte une position avec lng=0 mais lat significatif", () => {
    const result = validatePickupPosition({ lat: 5, lng: 0 });
    expect(result.ok).toBe(true);
  });

  it("refuse des coordonnées hors bornes (lat > 90)", () => {
    const result = validatePickupPosition({ lat: 91, lng: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pickup_position_out_of_bounds");
  });

  it("refuse des coordonnées hors bornes (lat < -90)", () => {
    const result = validatePickupPosition({ lat: -91, lng: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pickup_position_out_of_bounds");
  });

  it("refuse des coordonnées hors bornes (lng > 180)", () => {
    const result = validatePickupPosition({ lat: 0, lng: 181 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pickup_position_out_of_bounds");
  });
});
