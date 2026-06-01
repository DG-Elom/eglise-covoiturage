import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isValidCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";

// Cron quotidien : génère les instances futures de trajets récurrents.
// Réutilise la fonction SQL `generer_trajets_instances()` (RETURNS void, sans argument)
// via un client service_role. La fonction n'est pas dans les types générés,
// d'où le cast (comme ailleurs dans le repo).
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isValidCronAuth(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante (URL ou service_role)" },
      { status: 500 },
    );
  }

  const admin = createAdminClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.rpc("generer_trajets_instances" as never);
  if (error) {
    return NextResponse.json(
      { job: "generate-instances", ok: false, error: error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ job: "generate-instances", ok: true });
}
