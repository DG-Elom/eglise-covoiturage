import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushTo } from "@/lib/push";
import { validateRefuse } from "./_logic";

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

  const validationError = validateRefuse(
    { statut: resa.statut, trajets_instances: inst },
    user.id,
  );
  if (validationError) {
    return NextResponse.json(
      { error: validationError.code, current: validationError.current },
      { status: validationError.status },
    );
  }

  const refusedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("reservations")
    .update({ statut: "refused", traitee_le: refusedAt, motif_refus: "conducteur_refus" })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3201";

  void sendPushTo(resa.passager_id, "decision", {
    title: "Demande refusée",
    body: "Le conducteur n'a pas pu accepter ta demande. Cherche une autre option.",
    url: `${appUrl}/trajets/recherche`,
  }).catch((e) => console.warn("[refuse] push failed", e));

  return NextResponse.json({ ok: true });
}
