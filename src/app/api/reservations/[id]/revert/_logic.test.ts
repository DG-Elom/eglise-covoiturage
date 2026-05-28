import { describe, it, expect } from "vitest";
import { validateRevert } from "./_logic";

const BASE_RESA = {
  id: "resa-1",
  passager_id: "passager-1",
  statut: "accepted" as const,
  sens: "aller" as const,
  trajet_instance_id: "inst-1",
  trajets_instances: {
    date: "2026-06-01",
    trajets: { conducteur_id: "conducteur-1", culte_id: "culte-1" },
  },
};

describe("validateRevert", () => {
  it("accepte un revert valide : conducteur + statut accepted", () => {
    const result = validateRevert(BASE_RESA, "conducteur-1");
    expect(result).toBeNull();
  });

  it("rejette si l'utilisateur n'est pas le conducteur (403)", () => {
    const result = validateRevert(BASE_RESA, "autre-user");
    expect(result).toMatchObject({ code: "forbidden", status: 403 });
  });

  it("rejette si le statut est completed (409, code invalid_source_statut)", () => {
    const resa = { ...BASE_RESA, statut: "completed" as const };
    const result = validateRevert(resa, "conducteur-1");
    expect(result).toMatchObject({
      code: "invalid_source_statut",
      status: 409,
      current: "completed",
    });
  });

  it("rejette si le statut est refused (409, code invalid_source_statut)", () => {
    const resa = { ...BASE_RESA, statut: "refused" as const };
    const result = validateRevert(resa, "conducteur-1");
    expect(result).toMatchObject({
      code: "invalid_source_statut",
      status: 409,
      current: "refused",
    });
  });

  it("rejette si le statut est no_show (409, code invalid_source_statut)", () => {
    const resa = { ...BASE_RESA, statut: "no_show" as const };
    const result = validateRevert(resa, "conducteur-1");
    expect(result).toMatchObject({
      code: "invalid_source_statut",
      status: 409,
      current: "no_show",
    });
  });

  it("rejette si le statut est pending (409) — seul accepted→pending est autorisé", () => {
    const resa = { ...BASE_RESA, statut: "pending" as const };
    const result = validateRevert(resa, "conducteur-1");
    expect(result).toMatchObject({
      code: "invalid_source_statut",
      status: 409,
      current: "pending",
    });
  });
});
