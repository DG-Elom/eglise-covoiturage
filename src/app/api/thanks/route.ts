import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateThanksMessage } from "@/lib/thanks-validators";
import { sendPushTo } from "@/lib/push";

type PostBody = {
  destinataire_id?: string;
  reservation_id?: string;
  message?: string;
  is_public?: boolean;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const { destinataire_id, reservation_id, message = "", is_public = true } = body;

  if (!destinataire_id) {
    return NextResponse.json({ error: "destinataire_id_required" }, { status: 400 });
  }

  const validation = validateThanksMessage(message);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Si reservation_id fourni, vérifie que la résa concerne auteur + destinataire et est completed
  if (reservation_id) {
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select(
        `id, statut, passager_id,
         trajets_instances!inner (
           trajets!inner (
             conducteur_id
           )
         )`,
      )
      .eq("id", reservation_id)
      .maybeSingle();

    if (resError || !reservation) {
      return NextResponse.json({ error: "reservation_not_found" }, { status: 404 });
    }

    if (reservation.statut !== "completed") {
      return NextResponse.json({ error: "reservation_not_completed" }, { status: 422 });
    }

    const inst = Array.isArray(reservation.trajets_instances)
      ? reservation.trajets_instances[0]
      : reservation.trajets_instances;
    const trajet = inst
      ? Array.isArray((inst as { trajets: unknown }).trajets)
        ? (inst as { trajets: unknown[] }).trajets[0]
        : (inst as { trajets: unknown }).trajets
      : null;

    const conducteur_id = (trajet as { conducteur_id: string } | null)?.conducteur_id;
    const passager_id = reservation.passager_id;

    const isAuteurPassager = user.id === passager_id && destinataire_id === conducteur_id;
    const isAuteurConducteur = user.id === conducteur_id && destinataire_id === passager_id;

    if (!isAuteurPassager && !isAuteurConducteur) {
      return NextResponse.json({ error: "not_a_party" }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from("thanks")
    .insert({
      auteur_id: user.id,
      destinataire_id,
      reservation_id: reservation_id ?? null,
      message: message.trim(),
      is_public,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  // Récupère le prénom de l'auteur pour la notif (fire-and-forget)
  void (async () => {
    try {
      const { data: auteur } = await supabase
        .from("profiles")
        .select("prenom")
        .eq("id", user.id)
        .single();

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3201";
      await sendPushTo(destinataire_id, "thanks_received", {
        title: "Nouveau mot de remerciement",
        body: auteur?.prenom
          ? `${auteur.prenom} t'a envoyé un mot de remerciement`
          : "Tu as reçu un mot de remerciement",
        url: `${appUrl}/u/${destinataire_id}`,
      });
    } catch {
      // Notif non bloquante
    }
  })();

  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = req.nextUrl;
  const destinataire_id = searchParams.get("destinataire_id");

  if (!destinataire_id) {
    return NextResponse.json({ error: "destinataire_id_required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("thanks")
    .select(
      "id, message, is_public, created_at, auteur_id, destinataire_id, reservation_id",
    )
    .eq("destinataire_id", destinataire_id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ thanks: data ?? [] });
}
