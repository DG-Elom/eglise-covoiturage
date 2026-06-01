// Helper partagé : invoque une Supabase Edge Function en POST avec le
// service_role en Bearer. Utilisé par les routes cron thin-wrapper.
// Ne contient aucune logique métier : il réutilise les Edge Functions
// existantes (supabase/functions/*).

import { NextResponse } from "next/server";

/**
 * Appelle l'Edge Function `${SUPABASE_URL}/functions/v1/<name>` et renvoie
 * une NextResponse normalisée. Le service_role autorise l'invocation
 * (les Edge Functions tournent avec leurs propres env, body vide accepté).
 */
export async function invokeEdgeFunction(name: string): Promise<NextResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceRole) {
    return NextResponse.json(
      { error: "Configuration Supabase manquante (URL ou service_role)" },
      { status: 500 },
    );
  }

  const url = `${baseUrl.replace(/\/$/, "")}/functions/v1/${name}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur réseau Edge Function";
    return NextResponse.json({ error: msg, job: name }, { status: 502 });
  }

  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return NextResponse.json({ job: name, ok: res.ok, result: payload }, {
    status: res.ok ? 200 : 502,
  });
}
