import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PostBody = {
  trajet_id?: string;
  sens?: "aller" | "retour";
  pickup_adresse?: string;
  pickup_lat?: number;
  pickup_lng?: number;
};

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

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const { trajet_id, sens, pickup_adresse, pickup_lat, pickup_lng } = body;

  if (
    !trajet_id ||
    !sens ||
    !pickup_adresse ||
    typeof pickup_lat !== "number" ||
    typeof pickup_lng !== "number"
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (sens !== "aller" && sens !== "retour") {
    return NextResponse.json({ error: "invalid_sens" }, { status: 400 });
  }

  // Vérifie que le trajet existe et est actif
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
