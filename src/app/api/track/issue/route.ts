import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signTrackToken } from "@/lib/track-token";

type Body = {
  reservationId?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const { reservationId } = body;

  if (!reservationId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { data: reservation, error } = await supabase
    .from("reservations")
    .select(
      `id, passager_id, statut,
       trajets_instances!inner (
         date,
         trajets!inner (
           heure_depart
         )
       )`,
    )
    .eq("id", reservationId)
    .eq("passager_id", user.id)
    .maybeSingle();

  if (error || !reservation) {
    return NextResponse.json({ error: "reservation_not_found" }, { status: 404 });
  }

  if (reservation.statut !== "accepted") {
    return NextResponse.json({ error: "reservation_not_accepted" }, { status: 403 });
  }

  const inst = Array.isArray(reservation.trajets_instances)
    ? reservation.trajets_instances[0]
    : reservation.trajets_instances;

  const trajet = inst
    ? Array.isArray((inst as { trajets: unknown }).trajets)
      ? ((inst as { trajets: unknown[] }).trajets[0] as { heure_depart: string })
      : ((inst as { trajets: { heure_depart: string } }).trajets)
    : null;

  const maxExpiry = new Date(Date.now() + 4 * 60 * 60 * 1000);

  let expiresAt = maxExpiry;

  if (inst && trajet) {
    const instanceData = inst as { date: string };
    const dateStr = instanceData.date;
    const heureDepart = trajet.heure_depart;
    const [h, m] = heureDepart.split(":").map(Number);
    const departureDate = new Date(`${dateStr}T${heureDepart}:00`);
    if (!isNaN(departureDate.getTime())) {
      const tripEnd = new Date(
        departureDate.getTime() + 2 * 60 * 60 * 1000,
      );
      expiresAt = tripEnd < maxExpiry ? tripEnd : maxExpiry;
    }
    void h;
    void m;
  }

  const token = await signTrackToken({
    reservationId,
    passagerId: user.id,
    expiresAt,
  });

  const origin = new URL(request.url).origin;
  const url = `${origin}/track/${token}`;

  return NextResponse.json({ url, expiresAt: expiresAt.toISOString() });
}
