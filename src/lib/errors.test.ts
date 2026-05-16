import { describe, it, expect } from "vitest";
import { humanizeApiError } from "./errors";

describe("humanizeApiError", () => {
  it("traduit la violation UNIQUE de reservations en message clair", () => {
    expect(
      humanizeApiError(
        'duplicate key value violates unique constraint "reservations_passager_id_trajet_instance_id_sens_key"',
      ),
    ).toBe("Tu as déjà une demande pour ce trajet.");
  });

  it("traduit une violation UNIQUE generique", () => {
    expect(
      humanizeApiError(
        'duplicate key value violates unique constraint "foo_bar_key"',
      ),
    ).toBe("Cet élément existe déjà.");
  });

  it("traduit une violation RLS", () => {
    expect(humanizeApiError("permission denied for table trajets")).toBe(
      "Tu n'as pas les droits pour cette action.",
    );
  });

  it("traduit une erreur reseau", () => {
    expect(humanizeApiError("Failed to fetch")).toBe(
      "Problème de connexion. Vérifie ton réseau et réessaie.",
    );
  });

  it("traduit un code API connu", () => {
    expect(humanizeApiError("unauthorized")).toBe(
      "Tu dois te reconnecter pour continuer.",
    );
    expect(humanizeApiError("instance_full")).toBe("Ce trajet est complet.");
    expect(humanizeApiError("already_requested")).toBe(
      "Tu as déjà une demande pour ce trajet.",
    );
  });

  it("garde un message francais court deja lisible", () => {
    expect(humanizeApiError("Tu dois être conducteur pour cela.")).toBe(
      "Tu dois être conducteur pour cela.",
    );
  });

  it("masque les messages techniques inconnus", () => {
    expect(
      humanizeApiError(
        "PGRST116: relation public.foo does not exist (TypeError)",
      ),
    ).toBe("Une erreur est survenue. Réessaie dans un instant.");
  });

  it("renvoie le fallback pour null/undefined/vide", () => {
    expect(humanizeApiError(null)).toBe(
      "Une erreur est survenue. Réessaie dans un instant.",
    );
    expect(humanizeApiError(undefined)).toBe(
      "Une erreur est survenue. Réessaie dans un instant.",
    );
    expect(humanizeApiError("")).toBe(
      "Une erreur est survenue. Réessaie dans un instant.",
    );
  });

  it("accepte un objet Error/Supabase", () => {
    expect(
      humanizeApiError({
        message: 'duplicate key value violates unique constraint "x"',
      }),
    ).toBe("Cet élément existe déjà.");
    expect(humanizeApiError({ error: "unauthorized" })).toBe(
      "Tu dois te reconnecter pour continuer.",
    );
  });
});
