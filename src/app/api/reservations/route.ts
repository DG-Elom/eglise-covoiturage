import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { pickTopAlternatives, type TrajetAlternative } from "@/lib/capacity";
import type { Database } from "@/lib/supabase/types";

type Body = {
  trajet_instance_id: string;
  sens: "aller" | "retour";
  pickup_adresse: string;
  pickup_lat: number;
  pickup_lng: number;
  passager_lat?: number;
  passager_lng?: number;
  culte_id?: string;
  date?: string;
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
  const {
    trajet_instance_id,
    sens,
    pickup_adresse,
    pickup_lat,
    pickup_lng,
    passager_lat,
    passager_lng,
    culte_id,
    date,
  } = body;

  if (
    !trajet_instance_id ||
    !sens ||
    !pickup_adresse ||
    typeof pickup_lat !== "number" ||
    typeof pickup_lng !== "number"
  ) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Vérifie la capacité avant l'insert (optimistic check — le trigger BEFORE INSERT re-vérifie)
  // instance_places_restantes est définie en v29, pas encore dans les types générés → unknown
  const { data: remaining, error: rpcError } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, string>,
    ) => Promise<{ data: number | null; error: { message: string } | null }>
  )("instance_places_restantes", { p_instance_id: trajet_instance_id });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  if (remaining !== null && remaining <= 0) {
    return buildInstanceFullResponse(
      supabase,
      passager_lat,
      passager_lng,
      culte_id,
      sens,
      date,
    );
  }

  // Insert — le trigger BEFORE INSERT sécurise la race condition
  const { data, error } = await supabase
    .from("reservations")
    .insert({
      passager_id: user.id,
      trajet_instance_id,
      sens,
      pickup_adresse,
      pickup_position: `POINT(${pickup_lng} ${pickup_lat})`,
    })
    .select("id")
    .single();

  if (error) {
    if (error.message?.includes("instance_full")) {
      return buildInstanceFullResponse(
        supabase,
        passager_lat,
        passager_lng,
        culte_id,
        sens,
        date,
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

async function buildInstanceFullResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  passager_lat: number | undefined,
  passager_lng: number | undefined,
  culte_id: string | undefined,
  sens: string,
  date: string | undefined,
): Promise<NextResponse> {
  let alternatives: TrajetAlternative[] = [];

  if (
    passager_lat !== undefined &&
    passager_lng !== undefined &&
    culte_id &&
    date
  ) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey) {
      const admin = createAdminClient<Database>(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: candidates } = await admin.rpc("trajets_compatibles", {
        p_passager_lat: passager_lat,
        p_passager_lng: passager_lng,
        p_culte_id: culte_id,
        p_sens: sens as "aller" | "retour",
        p_date: date,
      });
      if (candidates) {
        alternatives = pickTopAlternatives(
          (candidates as TrajetAlternative[]).filter(
            (c) => c.trajet_instance_id !== undefined,
          ),
        );
      }
    }
  }

  return NextResponse.json(
    { error: "instance_full", alternatives },
    { status: 409 },
  );
}
