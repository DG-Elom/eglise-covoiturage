import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyTrackToken } from "@/lib/track-token";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const claims = await verifyTrackToken(token);
  if (!claims) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { reservationId } = claims;

  const supabase = await createClient();

  const { data: reservation, error: resError } = await supabase
    .from("reservations")
    .select(
      `trajet_instance_id,
       trajets_instances!inner (
         trajets!inner (
           conducteur_id,
           profiles!trajets_conducteur_id_fkey (
             prenom
           )
         )
       )`,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (resError || !reservation) {
    return NextResponse.json({ error: "reservation_not_found" }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const inst = Array.isArray(reservation.trajets_instances)
    ? reservation.trajets_instances[0]
    : reservation.trajets_instances;

  const trajetData = inst
    ? Array.isArray((inst as { trajets: unknown }).trajets)
      ? (inst as { trajets: unknown[] }).trajets[0]
      : (inst as { trajets: unknown }).trajets
    : null;

  const trajet = trajetData as {
    conducteur_id: string;
    profiles: { prenom: string } | { prenom: string }[] | null;
  } | null;

  const conducteurId = trajet?.conducteur_id ?? null;
  const profilesRaw = trajet?.profiles ?? null;
  const profile = Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw;
  const conducteurPrenom = profile?.prenom ?? "Conducteur";

  const { data: posRow } = await supabase
    .from("track_positions")
    .select("lat, lng, updated_at")
    .eq("trajet_instance_id", reservation.trajet_instance_id)
    .maybeSingle();

  if (!posRow) {
    return NextResponse.json(
      { error: "position_not_available" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  void conducteurId;

  return NextResponse.json(
    {
      lat: posRow.lat,
      lng: posRow.lng,
      updatedAt: posRow.updated_at,
      conducteurPrenom,
      etaMinutes: null,
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
