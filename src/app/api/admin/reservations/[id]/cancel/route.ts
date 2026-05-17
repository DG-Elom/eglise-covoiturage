import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushTo } from "@/lib/push";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin, prenom")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Recupere la resa + le passager + le conducteur (via instance/trajet)
  const { data: resa, error: fetchErr } = await supabase
    .from("reservations")
    .select(
      `id, statut, passager_id,
       trajets_instances!inner (
         date,
         trajets!inner ( conducteur_id, depart_adresse )
       )`,
    )
    .eq("id", id)
    .single();

  if (fetchErr || !resa) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (resa.statut === "cancelled") {
    return NextResponse.json(
      { error: "already_cancelled", id },
      { status: 409 },
    );
  }

  const inst = resa.trajets_instances as unknown as {
    date: string;
    trajets: { conducteur_id: string; depart_adresse: string };
  };

  const cancelledAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("reservations")
    .update({
      statut: "cancelled",
      cancelled_le: cancelledAt,
      motif_refus: "annulee_par_admin",
    } as never)
    .eq("id", id);

  if (updateErr) {
    console.error("[admin/cancel] UPDATE failed", {
      reservation_id: id,
      admin_id: user.id,
      updateErr,
    });
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3201";
  const dateLabel = new Date(inst.date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Notif passager (sa demande a ete annulee)
  void sendPushTo(resa.passager_id, "decision", {
    title: "Ta réservation a été annulée",
    body: `Un administrateur a annulé ta réservation du ${dateLabel}. Tu peux en faire une nouvelle dans l'app.`,
    url: `${appUrl}/dashboard`,
  }).catch((e) => console.warn("[admin/cancel] push passager failed", e));

  // Notif conducteur seulement si la resa etait active (pending ou accepted)
  // pour eviter de re-notifier sur un cancel de resa deja refusee/completed
  if (
    inst.trajets.conducteur_id !== resa.passager_id &&
    (resa.statut === "pending" || resa.statut === "accepted")
  ) {
    void sendPushTo(inst.trajets.conducteur_id, "decision", {
      title: "Une place se libère",
      body: `Une réservation sur ton trajet du ${dateLabel} a été annulée par un administrateur.`,
      url: `${appUrl}/dashboard`,
    }).catch((e) => console.warn("[admin/cancel] push conducteur failed", e));
  }

  return NextResponse.json({
    ok: true,
    id,
    previous_statut: resa.statut,
  });
}
