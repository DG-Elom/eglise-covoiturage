import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushTo } from "@/lib/push";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Vérification que l'utilisateur est bien le conducteur de cette résa
  const { data: resa, error: fetchErr } = await supabase
    .from("reservations")
    .select(
      `id, trajet_instance_id, statut,
       trajets_instances!inner (
         trajets!inner ( conducteur_id )
       )`,
    )
    .eq("id", id)
    .single();

  if (fetchErr || !resa) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const inst = resa.trajets_instances as unknown as {
    trajets: { conducteur_id: string };
  };
  if (inst.trajets.conducteur_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (resa.statut !== "pending") {
    return NextResponse.json(
      { error: "invalid_statut", current: resa.statut },
      { status: 409 },
    );
  }

  // Accept
  const acceptedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("reservations")
    .update({ statut: "accepted", traitee_le: acceptedAt } as never)
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Cherche les résa auto-refusées par le trigger sur la même instance
  // (motif_refus = 'trajet_complet_auto', dans la dernière minute pour éviter faux positifs)
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data: autoRefused } = await supabase
    .from("reservations")
    .select("id, passager_id")
    .eq("trajet_instance_id", resa.trajet_instance_id)
    .eq("statut", "refused")
    .eq("motif_refus", "trajet_complet_auto")
    .gte("traitee_le", since)
    .neq("id", id);

  // Push fire-and-forget aux passagers auto-refusés
  if (autoRefused && autoRefused.length > 0) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3201";
      void Promise.all(
        autoRefused.map((r) =>
          sendPushTo(r.passager_id, "decision", {
            title: "Trajet désormais complet",
            body: "Le conducteur a accepté un autre passager. Cherche une alternative.",
            url: `${appUrl}/trajets/recherche`,
          }).catch((e) =>
            console.warn("[accept] push auto-refused failed", e),
          ),
        ),
      );
    }
  }

  return NextResponse.json({ ok: true, autoRefusedCount: autoRefused?.length ?? 0 });
}
