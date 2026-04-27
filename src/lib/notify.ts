type NotifyKind =
  | "reservation_created"
  | "reservation_accepted"
  | "reservation_refused"
  | "trajet_date_cancelled";

export async function notify(kind: NotifyKind, reservationId: string) {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, reservationId }),
    });
  } catch (err) {
    console.warn("[notify] échec:", err);
  }
}
