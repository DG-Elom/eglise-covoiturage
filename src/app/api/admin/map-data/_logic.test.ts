import { describe, it, expect } from "vitest";
import {
  extractCoords,
  sensCompatible,
  joursDattente,
  nearestDriverFor,
  buildOrphelins,
  computeStats,
  type DemandeRaw,
  type TrajetRaw,
} from "./_logic";

const NOW = new Date("2026-06-01T12:00:00Z").getTime();

function demande(over: Partial<DemandeRaw> = {}): DemandeRaw {
  return {
    id: "d1",
    sens: "aller",
    culte_id: "c1",
    date: "2026-06-07",
    pickup_adresse: "12 rue de Metz",
    notes: null,
    created_at: "2026-06-01T10:00:00Z",
    position: { lat: 49.11, lng: 6.2 },
    passager: { id: "p1", prenom: "Marie", nom: "Durand", photo_url: null },
    culte: { libelle: "Culte du dimanche", heure: "10:00:00" },
    ...over,
  };
}

function trajet(over: Partial<TrajetRaw> = {}): TrajetRaw {
  return {
    id: "t1",
    sens: "aller",
    culte_id: "c1",
    places_total: 4,
    depart_adresse: "5 av. Foch",
    position: { lat: 49.12, lng: 6.21 },
    conducteur: { id: "co1", prenom: "Jean", nom: "Petit", photo_url: null },
    ...over,
  };
}

describe("extractCoords", () => {
  it("parse le GeoJSON Point PostGIS [lng, lat]", () => {
    expect(extractCoords({ type: "Point", coordinates: [6.176, 49.147] })).toEqual({
      lat: 49.147,
      lng: 6.176,
    });
  });
  it("retourne null pour un format invalide", () => {
    expect(extractCoords(null)).toBeNull();
    expect(extractCoords("POINT(6 49)")).toBeNull();
    expect(extractCoords({ type: "Point" })).toBeNull();
  });
});

describe("sensCompatible", () => {
  it("vrai si même sens", () => {
    expect(sensCompatible("aller", "aller")).toBe(true);
    expect(sensCompatible("retour", "retour")).toBe(true);
  });
  it("vrai si le trajet est aller_retour", () => {
    expect(sensCompatible("aller", "aller_retour")).toBe(true);
    expect(sensCompatible("retour", "aller_retour")).toBe(true);
  });
  it("faux si sens opposés", () => {
    expect(sensCompatible("aller", "retour")).toBe(false);
    expect(sensCompatible("retour", "aller")).toBe(false);
  });
});

describe("joursDattente", () => {
  it("compte les jours entiers écoulés", () => {
    expect(joursDattente("2026-05-29T12:00:00Z", NOW)).toBe(3);
    expect(joursDattente("2026-06-01T10:00:00Z", NOW)).toBe(0);
  });
  it("ne renvoie jamais de valeur négative", () => {
    expect(joursDattente("2026-06-10T00:00:00Z", NOW)).toBe(0);
  });
});

describe("nearestDriverFor", () => {
  it("retourne le conducteur compatible le plus proche", () => {
    const proche = trajet({ id: "proche", position: { lat: 49.111, lng: 6.201 } });
    const loin = trajet({ id: "loin", position: { lat: 49.3, lng: 6.5 } });
    const res = nearestDriverFor(demande(), [loin, proche]);
    expect(res?.trajetId).toBe("proche");
    expect(res?.distanceKm).toBeGreaterThanOrEqual(0);
  });
  it("ignore les trajets d'un autre culte", () => {
    const res = nearestDriverFor(demande(), [trajet({ culte_id: "autre" })]);
    expect(res).toBeNull();
  });
  it("ignore les trajets de sens incompatible", () => {
    const res = nearestDriverFor(demande({ sens: "aller" }), [trajet({ sens: "retour" })]);
    expect(res).toBeNull();
  });
  it("accepte un trajet aller_retour", () => {
    const res = nearestDriverFor(demande({ sens: "retour" }), [trajet({ sens: "aller_retour" })]);
    expect(res?.trajetId).toBe("t1");
  });
  it("retourne null si la demande n'a pas de position", () => {
    expect(nearestDriverFor(demande({ position: null }), [trajet()])).toBeNull();
  });
});

describe("buildOrphelins", () => {
  it("fait remonter d'abord les demandes sans conducteur, puis les plus anciennes", () => {
    const demandes: DemandeRaw[] = [
      // a un conducteur, récente
      demande({ id: "avec", culte_id: "c1", created_at: "2026-06-01T11:00:00Z" }),
      // sans conducteur (autre culte sans offre), ancienne
      demande({ id: "sans", culte_id: "cZ", created_at: "2026-05-20T10:00:00Z" }),
      // a un conducteur, ancienne
      demande({ id: "avecVieux", culte_id: "c1", created_at: "2026-05-25T10:00:00Z" }),
    ];
    const res = buildOrphelins(demandes, [trajet({ culte_id: "c1" })], NOW);
    expect(res.map((o) => o.id)).toEqual(["sans", "avecVieux", "avec"]);
    expect(res[0].nearest).toBeNull();
    expect(res[1].nearest).not.toBeNull();
  });
});

describe("computeStats", () => {
  it("compte demandes, offres et orphelins sans conducteur", () => {
    const orphelins = buildOrphelins(
      [demande({ id: "a", culte_id: "c1" }), demande({ id: "b", culte_id: "cZ" })],
      [trajet({ culte_id: "c1" })],
      NOW,
    );
    const stats = computeStats(orphelins, [
      trajet({ culte_id: "c1" }),
      trajet({ id: "t2", position: null }),
    ]);
    expect(stats.nbDemandes).toBe(2);
    expect(stats.nbOffres).toBe(1); // t2 sans position exclu
    expect(stats.nbSansConducteur).toBe(1); // la demande culte cZ
  });
});
