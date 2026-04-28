import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  reservation_id?: string;
  stars?: number;
  comment?: string;
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
  const { reservation_id, stars, comment } = body;

  if (!reservation_id || typeof stars !== "number" || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Verify user is part of this reservation and determine rated_id
  const { data: reservation, error: resError } = await supabase
    .from("reservations")
    .select(
      `id, passager_id,
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

  const inst = Array.isArray(reservation.trajets_instances)
    ? reservation.trajets_instances[0]
    : reservation.trajets_instances;
  const trajet = inst
    ? Array.isArray(inst.trajets)
      ? inst.trajets[0]
      : inst.trajets
    : null;

  if (!trajet) {
    return NextResponse.json({ error: "trajet_not_found" }, { status: 404 });
  }

  const conducteur_id = (trajet as { conducteur_id: string }).conducteur_id;
  const passager_id = reservation.passager_id;

  let rated_id: string;
  if (user.id === passager_id) {
    rated_id = conducteur_id;
  } else if (user.id === conducteur_id) {
    rated_id = passager_id;
  } else {
    return NextResponse.json({ error: "not_a_party" }, { status: 403 });
  }

  // Check for existing rating
  const { data: existing } = await supabase
    .from("trip_ratings")
    .select("id")
    .eq("reservation_id", reservation_id)
    .eq("rater_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_rated" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("trip_ratings")
    .insert({
      reservation_id,
      rater_id: user.id,
      rated_id,
      stars,
      comment: comment?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id });
}
