import { NextResponse, type NextRequest } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import { invokeEdgeFunction } from "@/lib/cron-invoke";

export const runtime = "nodejs";

// Cron résumé hebdo : génère le résumé IA et l'envoie aux admins.
// Réutilise l'Edge Function `weekly-summary` (la route src/app/api/ai/weekly-summary
// est protégée par auth admin user-based et ne convient pas à un cron).
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isValidCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  return invokeEdgeFunction("weekly-summary");
}
