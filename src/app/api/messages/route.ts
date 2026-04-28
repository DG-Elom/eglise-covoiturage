import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushTo } from "@/lib/push";

type Body = {
  reservation_id?: string;
  destinataire_id?: string;
  contenu?: string;
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { reservation_id, destinataire_id, contenu } = body;

  if (!reservation_id || !destinataire_id || !contenu) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const trimmed = contenu.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }
  if (trimmed.length > 2000) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }

  // Vérifier que l'utilisateur est bien partie de la réservation
  const { data: reservation } = await supabase
    .from("reservations")
    .select(
      `id, passager_id, statut,
       trajets_instances!inner (
         trajets!inner (conducteur_id)
       )`,
    )
    .eq("id", reservation_id)
    .maybeSingle();

  if (!reservation) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  type ResShape = {
    passager_id: string;
    statut: string;
    trajets_instances: { trajets: { conducteur_id: string } };
  };
  const r = reservation as unknown as ResShape;
  const conducteurId = r.trajets_instances.trajets.conducteur_id;
  const passagerId = r.passager_id;

  if (user.id !== conducteurId && user.id !== passagerId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (destinataire_id !== conducteurId && destinataire_id !== passagerId) {
    return NextResponse.json({ error: "invalid_recipient" }, { status: 400 });
  }
  if (destinataire_id === user.id) {
    return NextResponse.json({ error: "cannot_self" }, { status: 400 });
  }

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      reservation_id,
      expediteur_id: user.id,
      destinataire_id,
      contenu: trimmed,
    })
    .select("id")
    .single();

  if (error || !msg) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  // Push notification au destinataire
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("prenom")
    .eq("id", user.id)
    .maybeSingle();

  void sendPushTo(destinataire_id, {
    title: senderProfile?.prenom ?? "Nouveau message",
    body: trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed,
    url: `/messages/${reservation_id}`,
  }).catch((e) => console.warn("[messages] push failed", e));

  return NextResponse.json({ id: msg.id });
}
