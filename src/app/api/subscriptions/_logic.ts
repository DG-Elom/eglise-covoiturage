import { validatePickupPosition } from "@/lib/subscription-pickup";

export type LegacySubscriptionBody = {
  trajet_id: string;
  sens: "aller" | "retour";
  pickup_adresse: string;
  pickup_lat: number;
  pickup_lng: number;
};

export type NewSubscriptionBody = {
  from_reservation_id: string;
  sens?: "aller" | "retour";
};

export type PostBody = LegacySubscriptionBody | NewSubscriptionBody | Record<string, unknown>;

export type ParseResult =
  | { kind: "new"; from_reservation_id: string; sens?: "aller" | "retour" }
  | { kind: "legacy"; trajet_id: string; sens: "aller" | "retour"; pickup_adresse: string; pickup_lat: number; pickup_lng: number }
  | { kind: "error"; status: number; error: string };

export function parseSubscriptionBody(body: PostBody): ParseResult {
  if ("from_reservation_id" in body && typeof body.from_reservation_id === "string") {
    const sens = (body as NewSubscriptionBody).sens;
    if (sens !== undefined && sens !== "aller" && sens !== "retour") {
      return { kind: "error", status: 400, error: "invalid_sens" };
    }
    return { kind: "new", from_reservation_id: body.from_reservation_id, sens };
  }

  if ("trajet_id" in body) {
    const b = body as Partial<LegacySubscriptionBody>;
    if (
      !b.trajet_id ||
      !b.sens ||
      !b.pickup_adresse ||
      typeof b.pickup_lat !== "number" ||
      typeof b.pickup_lng !== "number"
    ) {
      return { kind: "error", status: 400, error: "invalid_body" };
    }

    if (b.sens !== "aller" && b.sens !== "retour") {
      return { kind: "error", status: 400, error: "invalid_sens" };
    }

    const posCheck = validatePickupPosition({ lat: b.pickup_lat, lng: b.pickup_lng });
    if (!posCheck.ok) {
      return {
        kind: "error",
        status: 400,
        error: posCheck.reason,
      };
    }

    return {
      kind: "legacy",
      trajet_id: b.trajet_id,
      sens: b.sens,
      pickup_adresse: b.pickup_adresse,
      pickup_lat: b.pickup_lat,
      pickup_lng: b.pickup_lng,
    };
  }

  return { kind: "error", status: 400, error: "invalid_body" };
}
