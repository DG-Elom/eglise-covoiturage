/**
 * Tests TDD pour PlacesRestantesLive.
 *
 * On teste :
 * 1. getPlacesColor — logique pure de couleur
 * 2. getPlacesLabel — logique pure du label
 * 3. Rendu du composant pour restantes = 0, 1, 3
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getPlacesColor, getPlacesLabel, PlacesRestantesLive } from "./places-restantes-live";

// Mock createClient pour éviter les appels Supabase réels en test
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  }),
}));

// ─── getPlacesColor ───────────────────────────────────────────────────────────

describe("getPlacesColor", () => {
  it("retourne 'red' pour 0 places", () => {
    expect(getPlacesColor(0)).toBe("red");
  });

  it("retourne 'amber' pour 1 place", () => {
    expect(getPlacesColor(1)).toBe("amber");
  });

  it("retourne 'emerald' pour 2 places", () => {
    expect(getPlacesColor(2)).toBe("emerald");
  });

  it("retourne 'emerald' pour plus de 2 places", () => {
    expect(getPlacesColor(5)).toBe("emerald");
  });
});

// ─── getPlacesLabel ───────────────────────────────────────────────────────────

describe("getPlacesLabel", () => {
  it("retourne 'Complet' pour 0 places", () => {
    expect(getPlacesLabel(0, 4)).toBe("Complet");
  });

  it("retourne '1/4 place' au singulier", () => {
    expect(getPlacesLabel(1, 4)).toBe("1/4 place");
  });

  it("retourne '3/4 places' au pluriel", () => {
    expect(getPlacesLabel(3, 4)).toBe("3/4 places");
  });

  it("retourne '2/2 places' quand places_total = places_restantes", () => {
    expect(getPlacesLabel(2, 2)).toBe("2/2 places");
  });
});

// ─── PlacesRestantesLive (rendu statique avec initialPlacesRestantes) ─────────

describe("PlacesRestantesLive", () => {
  it("affiche Complet en rouge quand restantes = 0", () => {
    render(
      <PlacesRestantesLive
        trajetInstanceId="inst-001"
        placesTotal={4}
        initialPlacesRestantes={0}
      />,
    );
    expect(screen.getByText("Complet")).toBeInTheDocument();
  });

  it("affiche '1/4 place' en amber quand restantes = 1", () => {
    render(
      <PlacesRestantesLive
        trajetInstanceId="inst-002"
        placesTotal={4}
        initialPlacesRestantes={1}
      />,
    );
    expect(screen.getByText("1/4 place")).toBeInTheDocument();
  });

  it("affiche '3/4 places' en emerald quand restantes = 3", () => {
    render(
      <PlacesRestantesLive
        trajetInstanceId="inst-003"
        placesTotal={4}
        initialPlacesRestantes={3}
      />,
    );
    expect(screen.getByText("3/4 places")).toBeInTheDocument();
  });

  it("affiche le tooltip 'Mis à jour en temps réel'", () => {
    render(
      <PlacesRestantesLive
        trajetInstanceId="inst-004"
        placesTotal={4}
        initialPlacesRestantes={2}
      />,
    );
    expect(screen.getByTitle("Mis à jour en temps réel")).toBeInTheDocument();
  });
});
