import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSubscriptionBody } from "./_logic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      `id, trajet_id, sens, pickup_adresse, actif, created_at,
       trajet:trajets!inner (
         heure_depart, depart_adresse,
         conducteur:profiles!trajets_conducteur_id_fkey (prenom, nom, photo_url),
         culte:cultes!inner (libelle, jour_semaine)
       )`,
    )
    .eq("passager_id", user.id)
    .eq("actif", true)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseSubscriptionBody(body);

  if (parsed.kind === "error") {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  if (parsed.kind === "new") {
    const { from_reservation_id } = parsed;

    const { data: resa } = await supabase
      .from("reservations")
      .select(
        `id, statut, sens, pickup_adresse, pickup_position,
         trajets_instances!inner (
           trajet_id
         )`,
      )
      .eq("id", from_reservation_id)
      .eq("passager_id", user.id)
      .in("statut", ["accepted", "completed"])
      .maybeSingle();

    if (!resa) {
      return NextResponse.json(
        { error: "reservation_not_found_or_not_eligible" },
        { status: 404 },
      );
    }

    const trajetId = (resa.trajets_instances as unknown as { trajet_id: string } | null)
      ?.trajet_id;
    if (!trajetId) {
      return NextResponse.json({ error: "trajet_not_found" }, { status: 404 });
    }

    const effectiveSens = (parsed.sens ?? resa.sens) as "aller" | "retour";
    if (effectiveSens !== "aller" && effectiveSens !== "retour") {
      return NextResponse.json({ error: "invalid_sens" }, { status: 400 });
    }

    const pickupAdresse = resa.pickup_adresse as string;
    const pickupPosition = resa.pickup_position as string | null;

    if (!pickupPosition || pickupPosition === "POINT(0 0)") {
      return NextResponse.json(
        { error: "pickup_position_null_island" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .upsert(
        {
          passager_id: user.id,
          trajet_id: trajetId,
          sens: effectiveSens,
          pickup_adresse: pickupAdresse,
          pickup_position: pickupPosition,
          actif: true,
        },
        { onConflict: "passager_id,trajet_id,sens", ignoreDuplicates: false },
      )
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "insert_failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  }

  // Legacy form
  const { trajet_id, sens, pickup_adresse, pickup_lat, pickup_lng } = parsed;

  const { data: trajet } = await supabase
    .from("trajets")
    .select("id, actif")
    .eq("id", trajet_id)
    .eq("actif", true)
    .maybeSingle();

  if (!trajet) {
    return NextResponse.json({ error: "trajet_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        passager_id: user.id,
        trajet_id,
        sens,
        pickup_adresse,
        pickup_position: `POINT(${pickup_lng} ${pickup_lat})`,
        actif: true,
      },
      { onConflict: "passager_id,trajet_id,sens", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
