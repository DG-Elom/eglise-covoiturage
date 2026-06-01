import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCurrentMonthImpact, type CurrentMonthImpact } from "@/lib/impact-server";

export const runtime = "nodejs";

export type ImpactResponse = CurrentMonthImpact;

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const data = await fetchCurrentMonthImpact();
    return NextResponse.json(data satisfies ImpactResponse);
  } catch (e) {
    console.error("[impact] fetch failed", e);
    return NextResponse.json({ error: "service_unavailable" }, { status: 500 });
  }
}
