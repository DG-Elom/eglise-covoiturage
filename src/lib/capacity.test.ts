import { describe, it, expect } from "vitest";
import {
  isInstanceFullError,
  mapCapacityError,
  pickTopAlternatives,
  type TrajetAlternative,
} from "./capacity";

describe("isInstanceFullError", () => {
  it("returns true when error code is instance_full", () => {
    expect(isInstanceFullError({ code: "instance_full" })).toBe(true);
  });

  it("returns true when error message is instance_full", () => {
    expect(isInstanceFullError({ message: "instance_full" })).toBe(true);
  });

  it("returns true when Supabase PostgreSQL error contains instance_full", () => {
    expect(
      isInstanceFullError({ message: "P0001: instance_full" }),
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isInstanceFullError({ code: "23505", message: "duplicate key" })).toBe(false);
  });

  it("returns false for null / undefined", () => {
    expect(isInstanceFullError(null)).toBe(false);
    expect(isInstanceFullError(undefined)).toBe(false);
  });
});

describe("mapCapacityError", () => {
  it("maps instance_full error to structured result", () => {
    const alts: TrajetAlternative[] = [
      {
        trajet_instance_id: "inst-1",
        conducteur_id: "cond-1",
        conducteur_prenom: "Jean",
        conducteur_photo_url: null,
        depart_adresse: "12 rue de la Paix, Metz",
        heure_depart: "08:30",
        places_restantes: 2,
        detour_km: 1.2,
        score: 85,
        dans_zone: true,
        trajet_id: "traj-1",
      },
    ];
    const result = mapCapacityError(alts);
    expect(result.kind).toBe("instance_full");
    expect(result.alternatives).toHaveLength(1);
    expect(result.alternatives[0].conducteur_prenom).toBe("Jean");
  });

  it("returns empty alternatives when none provided", () => {
    const result = mapCapacityError([]);
    expect(result.kind).toBe("instance_full");
    expect(result.alternatives).toHaveLength(0);
  });
});

describe("pickTopAlternatives", () => {
  const makeAlt = (
    id: string,
    places: number,
    score: number,
  ): TrajetAlternative => ({
    trajet_instance_id: id,
    conducteur_id: `cond-${id}`,
    conducteur_prenom: "Dupont",
    conducteur_photo_url: null,
    depart_adresse: "Metz",
    heure_depart: "08:00",
    places_restantes: places,
    detour_km: 2,
    score,
    dans_zone: true,
    trajet_id: `traj-${id}`,
  });

  it("returns at most 3 alternatives", () => {
    const alts = [
      makeAlt("a", 1, 90),
      makeAlt("b", 2, 80),
      makeAlt("c", 3, 70),
      makeAlt("d", 1, 60),
    ];
    expect(pickTopAlternatives(alts)).toHaveLength(3);
  });

  it("excludes alternatives with no places left", () => {
    const alts = [
      makeAlt("a", 0, 90),
      makeAlt("b", 2, 80),
      makeAlt("c", 1, 70),
    ];
    const result = pickTopAlternatives(alts);
    expect(result.every((a) => a.places_restantes > 0)).toBe(true);
    expect(result).toHaveLength(2);
  });

  it("sorts by score descending", () => {
    const alts = [
      makeAlt("a", 1, 50),
      makeAlt("b", 1, 90),
      makeAlt("c", 1, 70),
    ];
    const result = pickTopAlternatives(alts);
    expect(result[0].trajet_instance_id).toBe("b");
    expect(result[1].trajet_instance_id).toBe("c");
    expect(result[2].trajet_instance_id).toBe("a");
  });

  it("returns empty array when all alternatives are full", () => {
    const alts = [makeAlt("a", 0, 90), makeAlt("b", 0, 80)];
    expect(pickTopAlternatives(alts)).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(pickTopAlternatives([])).toHaveLength(0);
  });
});
