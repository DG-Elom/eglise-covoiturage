type RevertValidationError = {
  code: "forbidden" | "invalid_source_statut";
  status: 403 | 409;
  current?: string;
};

type ResaForRevert = {
  statut: string;
  trajets_instances: {
    trajets: { conducteur_id: string };
  };
};

export function validateRevert(
  resa: ResaForRevert,
  userId: string,
): RevertValidationError | null {
  if (resa.trajets_instances.trajets.conducteur_id !== userId) {
    return { code: "forbidden", status: 403 };
  }
  if (resa.statut !== "accepted") {
    return {
      code: "invalid_source_statut",
      status: 409,
      current: resa.statut,
    };
  }
  return null;
}
