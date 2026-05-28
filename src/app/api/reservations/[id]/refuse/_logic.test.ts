import { describe, it, expect } from "vitest";
import { validateRefuse } from "./_logic";

const BASE_RESA = {
  id: "resa-1",
  passager_id: "passager-1",
  statut: "pending" as const,
  sens: "aller" as const,
  trajet_instance_id: "inst-1",
  trajets_instances: {
    date: "2026-06-01",
    trajets: { conducteur_id: "conducteur-1", culte_id: "culte-1" },
  },
};

describe("validateRefuse", () => {
  it("accepte un refus valide : conducteur + statut pending", () => {
    const result = validateRefuse(BASE_RESA, "conducteur-1");
    expect(result).toBeNull();
  });

  it("rejette si l'utilisateur n'est pas le conducteur", () => {
    const result = validateRefuse(BASE_RESA, "autre-user");
    expect(result).toMatchObject({ code: "forbidden", status: 403 });
  });

  it("rejette si le statut n'est pas pending", () => {
    const resa = { ...BASE_RESA, statut: "accepted" as const };
    const result = validateRefuse(resa, "conducteur-1");
    expect(result).toMatchObject({ code: "invalid_statut", status: 409 });
  });

  it("inclut le statut actuel dans l'erreur invalid_statut", () => {
    const resa = { ...BASE_RESA, statut: "refused" as const };
    const result = validateRefuse(resa, "conducteur-1");
    expect(result).toMatchObject({ code: "invalid_statut", current: "refused" });
  });
});
