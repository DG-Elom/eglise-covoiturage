import { describe, expect, it } from "vitest";
import { distanceDepuisDepartsKm, type DepartConducteur } from "./demande-distance";

const METZ = { lat: 49.1193, lng: 6.1757 };
const THIONVILLE = { lat: 49.3579, lng: 6.1683 };
const NANCY = { lat: 48.6921, lng: 6.1844 };

const pickupMetz = { position: METZ, culte_id: "c1", sens: "aller" as const };

describe("distanceDepuisDepartsKm", () => {
  it("renvoie null sans départ connu", () => {
    expect(distanceDepuisDepartsKm(pickupMetz, [])).toBeNull();
  });

  it("renvoie null si la demande n'a pas de position", () => {
    const departs: DepartConducteur[] = [{ position: NANCY, culte_id: "c1", sens: "aller" }];
    expect(distanceDepuisDepartsKm({ ...pickupMetz, position: null }, departs)).toBeNull();
  });

  it("préfère le départ d'un trajet compatible (même programme, sens couvert) même s'il est plus loin", () => {
    const departs: DepartConducteur[] = [
      { position: THIONVILLE, culte_id: "autre", sens: "aller" },
      { position: NANCY, culte_id: "c1", sens: "aller_retour" },
    ];
    const res = distanceDepuisDepartsKm(pickupMetz, departs);
    expect(res?.compatible).toBe(true);
    expect(res?.km).toBeGreaterThan(45);
    expect(res?.km).toBeLessThan(55);
  });

  it("se replie sur le départ le plus proche si aucun trajet n'est compatible", () => {
    const departs: DepartConducteur[] = [
      { position: NANCY, culte_id: "c1", sens: "retour" },
      { position: THIONVILLE, culte_id: "autre", sens: "aller" },
    ];
    const res = distanceDepuisDepartsKm(pickupMetz, departs);
    expect(res?.compatible).toBe(false);
    // Thionville (~26 km) plutôt que Nancy (~48 km)
    expect(res?.km).toBeGreaterThan(20);
    expect(res?.km).toBeLessThan(30);
  });

  it("ignore les départs sans position", () => {
    const departs: DepartConducteur[] = [{ position: null, culte_id: "c1", sens: "aller" }];
    expect(distanceDepuisDepartsKm(pickupMetz, departs)).toBeNull();
  });
});
