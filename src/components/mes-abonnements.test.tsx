import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatSens, formatJour, desactiverAbonnement } from "./mes-abonnements.utils";

describe("formatSens", () => {
  it("retourne 'Aller' pour 'aller'", () => {
    expect(formatSens("aller")).toBe("Aller");
  });

  it("retourne 'Retour' pour 'retour'", () => {
    expect(formatSens("retour")).toBe("Retour");
  });
});

describe("formatJour", () => {
  it("retourne 'Dimanche' pour jour 0", () => {
    expect(formatJour(0)).toBe("Dimanche");
  });

  it("retourne 'Lundi' pour jour 1", () => {
    expect(formatJour(1)).toBe("Lundi");
  });

  it("retourne 'Jeudi' pour jour 4", () => {
    expect(formatJour(4)).toBe("Jeudi");
  });

  it("retourne 'Samedi' pour jour 6", () => {
    expect(formatJour(6)).toBe("Samedi");
  });

  it("retourne un fallback pour un jour hors plage", () => {
    expect(formatJour(7)).toBe("Jour 7");
  });
});

describe("desactiverAbonnement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("appelle DELETE /api/subscriptions/[id]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await desactiverAbonnement("sub-abc-123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/subscriptions/sub-abc-123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("retourne true en cas de succès (ok: true)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const result = await desactiverAbonnement("sub-xyz");
    expect(result).toBe(true);
  });

  it("retourne false quand la réponse n'est pas ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await desactiverAbonnement("sub-xyz");
    expect(result).toBe(false);
  });
});
