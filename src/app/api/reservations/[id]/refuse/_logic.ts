type RefuseValidationError = {
  code: "forbidden" | "invalid_statut";
  status: 403 | 409;
  current?: string;
};

type ResaForRefuse = {
  statut: string;
  trajets_instances: {
    trajets: { conducteur_id: string };
  };
};

export function validateRefuse(
  resa: ResaForRefuse,
  userId: string,
): RefuseValidationError | null {
  if (resa.trajets_instances.trajets.conducteur_id !== userId) {
    return { code: "forbidden", status: 403 };
  }
  if (resa.statut !== "pending") {
    return { code: "invalid_statut", status: 409, current: resa.statut };
  }
  return null;
}
