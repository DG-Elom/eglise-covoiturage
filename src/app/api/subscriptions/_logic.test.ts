import { describe, it, expect } from "vitest";
import { parseSubscriptionBody } from "./_logic";

describe("parseSubscriptionBody", () => {
  describe("nouvelle forme (from_reservation_id)", () => {
    it("retourne kind=new avec l'ID de réservation", () => {
      const result = parseSubscriptionBody({ from_reservation_id: "resa-123" });
      expect(result.kind).toBe("new");
      if (result.kind === "new") {
        expect(result.from_reservation_id).toBe("resa-123");
        expect(result.sens).toBeUndefined();
      }
    });

    it("accepte un sens optionnel", () => {
      const result = parseSubscriptionBody({ from_reservation_id: "resa-123", sens: "aller" });
      expect(result.kind).toBe("new");
      if (result.kind === "new") {
        expect(result.sens).toBe("aller");
      }
    });

    it("retourne error 400 si sens invalide", () => {
      const result = parseSubscriptionBody({ from_reservation_id: "resa-123", sens: "invalid" as "aller" });
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.status).toBe(400);
        expect(result.error).toBe("invalid_sens");
      }
    });
  });

  describe("ancienne forme (trajet_id legacy)", () => {
    const validLegacy = {
      trajet_id: "trajet-abc",
      sens: "aller" as const,
      pickup_adresse: "12 rue de la Paix, Paris",
      pickup_lat: 48.85,
      pickup_lng: 2.35,
    };

    it("retourne kind=legacy pour un body valide", () => {
      const result = parseSubscriptionBody(validLegacy);
      expect(result.kind).toBe("legacy");
    });

    it("refuse pickup_lat=0 et pickup_lng=0 (bug null island)", () => {
      const result = parseSubscriptionBody({ ...validLegacy, pickup_lat: 0, pickup_lng: 0 });
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.status).toBe(400);
        expect(result.error).toBe("pickup_position_null_island");
      }
    });

    it("refuse un body incomplet (sans pickup_adresse)", () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pickup_adresse: _omit, ...incomplete } = validLegacy;
      const result = parseSubscriptionBody(incomplete as Record<string, unknown>);
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.status).toBe(400);
        expect(result.error).toBe("invalid_body");
      }
    });

    it("refuse un sens invalide", () => {
      const result = parseSubscriptionBody({ ...validLegacy, sens: "aller_retour" as "aller" });
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.error).toBe("invalid_sens");
      }
    });

    it("refuse des coordonnées hors bornes", () => {
      const result = parseSubscriptionBody({ ...validLegacy, pickup_lat: 95, pickup_lng: 2.35 });
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.error).toBe("pickup_position_out_of_bounds");
      }
    });
  });

  describe("body invalide", () => {
    it("retourne error 400 pour un body vide", () => {
      const result = parseSubscriptionBody({});
      expect(result.kind).toBe("error");
      if (result.kind === "error") {
        expect(result.status).toBe(400);
      }
    });
  });
});
