import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toGeoJSON, type HeatmapRow } from "./_logic";

export const runtime = "nodejs";

const VALID_DAYS = [7, 30, 90] as const;
type ValidDays = (typeof VALID_DAYS)[number];

function parseDays(param: string | null): ValidDays {
  const n = Number(param);
  if ((VALID_DAYS as readonly number[]).includes(n)) return n as ValidDays;
  return 30;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.is_admin) {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  const days = parseDays(req.nextUrl.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rawRows, error } = await supabase
    .from("reservations")
    .select("pickup_position")
    .in("statut", ["pending", "cancelled"])
    .gte("demande_le", since);

  if (error) {
    return NextResponse.json({ error: "Erreur de chargement" }, { status: 500 });
  }

  const grouped = new Map<string, { position: unknown; count: number }>();
  for (const row of rawRows ?? []) {
    if (!row.pickup_position) continue;
    const key = JSON.stringify(row.pickup_position);
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, { position: row.pickup_position, count: 1 });
    }
  }

  const rows: HeatmapRow[] = Array.from(grouped.values()).map((g) => ({
    pickup_position: g.position,
    weight: g.count,
  }));

  return NextResponse.json(toGeoJSON(rows));
}
