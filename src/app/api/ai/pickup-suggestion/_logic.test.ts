import { describe, it, expect } from "vitest";
import { parseGeoPoint, buildPickupPrompt } from "./_logic";

describe("parseGeoPoint", () => {
  it("parse le format GeoJSON PostGIS", () => {
    const pt = parseGeoPoint({ type: "Point", coordinates: [6.1765, 49.1193] });
    expect(pt).toEqual({ lat: 49.1193, lng: 6.1765 });
  });

  it("parse le format {lat, lng}", () => {
    const pt = parseGeoPoint({ lat: 49.1193, lng: 6.1765 });
    expect(pt).toEqual({ lat: 49.1193, lng: 6.1765 });
  });

  it("parse le format {latitude, longitude}", () => {
    const pt = parseGeoPoint({ latitude: 49.1193, longitude: 6.1765 });
    expect(pt).toEqual({ lat: 49.1193, lng: 6.1765 });
  });

  it("retourne null pour null", () => {
    expect(parseGeoPoint(null)).toBeNull();
  });

  it("retourne null pour un objet invalide", () => {
    expect(parseGeoPoint({ foo: "bar" })).toBeNull();
  });

  it("retourne null pour un string", () => {
    expect(parseGeoPoint("49.1193,6.1765")).toBeNull();
  });
});

describe("buildPickupPrompt", () => {
  const depart = { lat: 49.12, lng: 6.17 };
  const eglise = { lat: 49.11, lng: 6.18 };
  const passagers = [
    { lat: 49.115, lng: 6.175, adresse: "12 rue de la Paix, Metz" },
  ];

  it("inclut les coordonnées du départ", () => {
    const prompt = buildPickupPrompt(depart, "Domicile conducteur", passagers, eglise, "Église ICC Metz");
    expect(prompt).toContain("49.120000");
    expect(prompt).toContain("6.170000");
  });

  it("inclut l'adresse de l'église", () => {
    const prompt = buildPickupPrompt(depart, "Domicile", passagers, eglise, "Église ICC Metz");
    expect(prompt).toContain("Église ICC Metz");
  });

  it("inclut les coordonnées du passager", () => {
    const prompt = buildPickupPrompt(depart, "Domicile", passagers, eglise, "Église");
    expect(prompt).toContain("49.115000");
  });

  it("demande une réponse JSON strict", () => {
    const prompt = buildPickupPrompt(depart, "Domicile", passagers, eglise, "Église");
    expect(prompt).toContain("suggestions");
    expect(prompt).toContain("JSON");
  });
});
