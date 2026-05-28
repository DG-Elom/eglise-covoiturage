import { describe, it, expect } from "vitest";
import {
  buildEligibles,
  type InactifProfile,
  type ReservationRow,
  type EngagementLogRow,
} from "./_logic";

describe("buildEligibles", () => {
  const now = new Date("2024-06-15T12:00:00Z").getTime();

  const makeProfile = (
    id: string,
    charteAccepteeAt: string,
  ): InactifProfile => ({
    id,
    prenom: "Jean",
    nom: "Dupont",
    charte_acceptee_at: charteAccepteeAt,
  });

  it("exclut un passager qui a au moins une réservation", () => {
    const inactifs: InactifProfile[] = [
      makeProfile("u1", new Date(now - 3 * 24 * 3600 * 1000).toISOString()),
    ];
    const reservations: ReservationRow[] = [{ passager_id: "u1" }];
    const logs: EngagementLogRow[] = [];

    const result = buildEligibles(inactifs, reservations, logs, now);
    expect(result).toHaveLength(0);
  });

  it("inclut un passager sans réservation dans la fenêtre d2", () => {
    const charteDate = new Date(now - 3 * 24 * 3600 * 1000).toISOString(); // 3 jours → d2
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const reservations: ReservationRow[] = [];
    const logs: EngagementLogRow[] = [];

    const result = buildEligibles(inactifs, reservations, logs, now);
    expect(result).toHaveLength(1);
    expect(result[0].next_kind).toBe("engage_d2");
    expect(result[0].age_jours).toBe(3);
  });

  it("inclut un passager sans réservation dans la fenêtre d7", () => {
    const charteDate = new Date(now - 8 * 24 * 3600 * 1000).toISOString();
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const result = buildEligibles(inactifs, [], [], now);
    expect(result[0].next_kind).toBe("engage_d7");
    expect(result[0].age_jours).toBe(8);
  });

  it("inclut un passager sans réservation dans la fenêtre d14", () => {
    const charteDate = new Date(now - 20 * 24 * 3600 * 1000).toISOString();
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const result = buildEligibles(inactifs, [], [], now);
    expect(result[0].next_kind).toBe("engage_d14");
    expect(result[0].age_jours).toBe(20);
  });

  it("exclut un passager hors fenêtre (trop récent < 2j)", () => {
    const charteDate = new Date(now - 1 * 24 * 3600 * 1000).toISOString();
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const result = buildEligibles(inactifs, [], [], now);
    expect(result).toHaveLength(0);
  });

  it("exclut un passager hors fenêtre (trop ancien >= 28j)", () => {
    const charteDate = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const result = buildEligibles(inactifs, [], [], now);
    expect(result).toHaveLength(0);
  });

  it("exclut un passager qui a déjà reçu le kind correspondant", () => {
    const charteDate = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const logs: EngagementLogRow[] = [{ user_id: "u1", kind: "engage_d2" }];

    const result = buildEligibles(inactifs, [], logs, now);
    expect(result).toHaveLength(0);
  });

  it("n'exclut pas un passager qui a reçu un kind différent", () => {
    const charteDate = new Date(now - 3 * 24 * 3600 * 1000).toISOString();
    const inactifs: InactifProfile[] = [makeProfile("u1", charteDate)];
    const logs: EngagementLogRow[] = [{ user_id: "u1", kind: "engage_d7" }];

    const result = buildEligibles(inactifs, [], logs, now);
    expect(result).toHaveLength(1);
    expect(result[0].next_kind).toBe("engage_d2");
  });

  it("gère plusieurs passagers correctement en une passe", () => {
    const profiles: InactifProfile[] = [
      makeProfile("u1", new Date(now - 3 * 24 * 3600 * 1000).toISOString()), // éligible d2
      makeProfile("u2", new Date(now - 8 * 24 * 3600 * 1000).toISOString()), // éligible d7
      makeProfile("u3", new Date(now - 20 * 24 * 3600 * 1000).toISOString()), // éligible d14
      makeProfile("u4", new Date(now - 1 * 24 * 3600 * 1000).toISOString()), // hors fenêtre
    ];
    const reservations: ReservationRow[] = [{ passager_id: "u2" }]; // u2 a une resa
    const logs: EngagementLogRow[] = [{ user_id: "u3", kind: "engage_d14" }]; // u3 déjà notifié

    const result = buildEligibles(profiles, reservations, logs, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
    expect(result[0].next_kind).toBe("engage_d2");
  });
});
