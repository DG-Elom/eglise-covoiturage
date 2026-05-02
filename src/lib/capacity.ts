export type TrajetAlternative = {
  trajet_instance_id: string;
  trajet_id: string;
  conducteur_id: string;
  conducteur_prenom: string;
  conducteur_photo_url: string | null;
  depart_adresse: string;
  heure_depart: string;
  places_restantes: number;
  detour_km: number;
  score: number;
  dans_zone: boolean;
};

export type CapacityErrorResult = {
  kind: "instance_full";
  alternatives: TrajetAlternative[];
};

type ErrorLike = { code?: string; message?: string } | null | undefined;

export function isInstanceFullError(err: ErrorLike): boolean {
  if (!err) return false;
  const { code, message } = err as { code?: string; message?: string };
  return (
    code === "instance_full" ||
    (typeof message === "string" && message.includes("instance_full"))
  );
}

export function mapCapacityError(
  alternatives: TrajetAlternative[],
): CapacityErrorResult {
  return { kind: "instance_full", alternatives };
}

export function pickTopAlternatives(
  candidates: TrajetAlternative[],
  limit = 3,
): TrajetAlternative[] {
  return candidates
    .filter((a) => a.places_restantes > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
