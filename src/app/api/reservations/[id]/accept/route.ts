import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendPushTo } from "@/lib/push";
import type { Database } from "@/lib/supabase/types";

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
      `id, passager_id, sens, trajet_instance_id, statut,
       trajets_instances!inner (
         date,
         trajets!inner ( conducteur_id, culte_id )
       )`,
    )
    .eq("id", id)
    .single();

  if (fetchErr || !resa) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const inst = resa.trajets_instances as unknown as {
    date: string;
    trajets: { conducteur_id: string; culte_id: string };
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3201";

  // --- Auto-cancel cross-instance : annuler les autres réservations pending
  // du même passager pour le même culte + date + sens chez d'autres conducteurs
  let crossCancelledCount = 0;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    const admin = createSupabaseClient<Database>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Trouver toutes les instances du même culte+date
    const { data: sameInstances } = await admin
      .from("trajets_instances")
      .select("id, trajets!inner ( culte_id )")
      .eq("date", inst.date)
      .eq("trajets.culte_id", inst.trajets.culte_id)
      .neq("id", resa.trajet_instance_id);

    const sameInstanceIds = (sameInstances ?? []).map(
      (i: { id: string }) => i.id,
    );

    if (sameInstanceIds.length > 0) {
      // Annuler les réservations pending du même passager sur ces instances
      const { data: cancelled } = await admin
        .from("reservations")
        .update({
          statut: "cancelled",
          cancelled_le: acceptedAt,
          motif_refus: "accepte_ailleurs",
        } as never)
        .eq("passager_id", resa.passager_id)
        .eq("sens", resa.sens)
        .eq("statut", "pending")
        .in("trajet_instance_id", sameInstanceIds)
        .select("id, trajet_instance_id");

      crossCancelledCount = cancelled?.length ?? 0;

      // Notifier les conducteurs concernés que la place est libérée
      if (cancelled && cancelled.length > 0) {
        const cancelledInstanceIds = cancelled.map(
          (c: { trajet_instance_id: string }) => c.trajet_instance_id,
        );
        const { data: affectedTrajets } = await admin
          .from("trajets_instances")
          .select("trajets!inner ( conducteur_id )")
          .in("id", cancelledInstanceIds);

        const conducteurIds = [
          ...new Set(
            (affectedTrajets ?? []).map(
              (t: unknown) =>
                (t as { trajets: { conducteur_id: string } }).trajets
                  .conducteur_id,
            ),
          ),
        ];

        void Promise.all(
          conducteurIds.map((cId) =>
            sendPushTo(cId, "decision", {
              title: "Demande annulée automatiquement",
              body: "Un passager a été accepté par un autre conducteur pour ce trajet.",
              url: `${appUrl}/dashboard`,
            }).catch((e) =>
              console.warn("[accept] push cross-cancel failed", e),
            ),
          ),
        );
      }
    }

    // --- Auto-match demandes_passager : marquer les demandes actives correspondantes
    const { data: matchedDemandes } = await admin
      .from("demandes_passager")
      .update({
        statut: "matched",
        updated_at: acceptedAt,
      } as never)
      .eq("passager_id", resa.passager_id)
      .eq("culte_id", inst.trajets.culte_id)
      .eq("date", inst.date)
      .eq("sens", resa.sens)
      .eq("statut", "active")
      .select("id");

    if (matchedDemandes && matchedDemandes.length > 0) {
      console.log(
        `[accept] auto-matched ${matchedDemandes.length} demande(s) for passager ${resa.passager_id}`,
      );
    }
  }

  // --- Cherche les résa auto-refusées par le trigger sur la même instance
  // (motif_refus = 'trajet_complet_auto', dans la dernière minute)
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

  return NextResponse.json({
    ok: true,
    autoRefusedCount: autoRefused?.length ?? 0,
    crossCancelledCount,
  });
}
