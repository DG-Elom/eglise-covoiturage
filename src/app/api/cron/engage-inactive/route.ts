import { NextResponse, type NextRequest } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { invokeEdgeFunction } from "@/lib/cron-invoke";

export const runtime = "nodejs";

// Cron relance des inactifs : push + email aux inscrits qui n'ont jamais réservé.
// Réutilise l'Edge Function `engage-inactive-passengers`.
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isValidCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return invokeEdgeFunction("engage-inactive-passengers");
}
