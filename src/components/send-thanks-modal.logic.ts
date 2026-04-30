type SubmitThanksParams = {
  destinataireId: string;
  reservationId: string | null;
  message: string;
  isPublic: boolean;
};

type SubmitThanksResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function submitThanks(params: SubmitThanksParams): Promise<SubmitThanksResult> {
  try {
    const res = await fetch("/api/thanks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destinataire_id: params.destinataireId,
        reservation_id: params.reservationId,
        message: params.message,
        is_public: params.isPublic,
      }),
    });

    const json = (await res.json()) as { id?: string; error?: string };

    if (!res.ok) {
      return { ok: false, error: json.error ?? "unknown_error" };
    }

    return { ok: true, id: json.id ?? "" };
  } catch {
    return { ok: false, error: "network_error" };
  }
}
