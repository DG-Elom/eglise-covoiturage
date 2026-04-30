// Edge Function: empty-seat-alert
// Déclenchée par le trigger trg_empty_seat_alert (via pg_net) quand un passager
// `accepted` annule sa résa à moins de H-12h du départ.
//
// Body attendu : { trajet_instance_id: string, sens: string }
//
// Priorité 1 : passagers `pending` sur la même instance → push "place libérée"
// Priorité 2 : passagers `pending` sur un autre trajet du même culte/date
//              sans réponse depuis 1h+

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface RequestBody {
  trajet_instance_id: string;
  sens: string;
}

interface InstanceRow {
  id: string;
  date: string;
  trajet: {
    culte_id: string;
    heure_depart: string | null;
    culte: {
      libelle: string;
    } | null;
  } | null;
}

interface ReservationRow {
  id: string;
  passager_id: string;
  demande_le: string;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const APP_URL           = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://covoiturage.local";

async function sendWebPush(sub: SubRow, payload: PushPayload): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  // Import web-push via esm.sh (compatible Deno)
  const webpush = await import("https://esm.sh/web-push@3.6.7");

  webpush.default.setVapidDetails(
    "mailto:no-reply@eglise.app",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );

  const subscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  await webpush.default.sendNotification(subscription, JSON.stringify(payload));
}

async function notifyPassager(
  client: SupabaseClient,
  passagerId: string,
  payload: PushPayload,
): Promise<void> {
  const { data: subs, error } = await client
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id")
    .eq("user_id", passagerId);

  if (error || !subs || subs.length === 0) return;

  await Promise.all(
    (subs as SubRow[]).map(async (sub) => {
      try {
        await sendWebPush(sub, payload);
      } catch (err) {
        console.warn("[empty-seat-alert] push failed for", passagerId, err);
        // Suppression des endpoints invalides (410 = gone, 404 = not found)
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          await client.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
}

const run = async (body: RequestBody): Promise<{ notified: number }> => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Récupérer les infos de l'instance (date, culte, heure)
  const { data: instanceRaw, error: instErr } = await client
    .from("trajets_instances")
    .select(`
      id, date,
      trajet:trajets!inner (
        culte_id,
        heure_depart,
        culte:cultes!inner ( libelle )
      )
    `)
    .eq("id", body.trajet_instance_id)
    .single();

  if (instErr || !instanceRaw) {
    throw new Error(`Instance not found: ${body.trajet_instance_id}`);
  }

  const instance = instanceRaw as unknown as InstanceRow;
  const culteLibelle = instance.trajet?.culte?.libelle ?? "culte";
  const culteId      = instance.trajet?.culte_id ?? "";
  const instanceDate = instance.date;

  const pushPayload: PushPayload = {
    title: "Place libérée !",
    body:  `Une place vient de se libérer pour ${culteLibelle} le ${instanceDate}. Réponds vite !`,
    url:   `${APP_URL}/dashboard`,
  };

  // 2. Priorité 1 : passagers `pending` sur cette instance
  const { data: p1Raw, error: p1Err } = await client
    .from("reservations")
    .select("id, passager_id, demande_le")
    .eq("trajet_instance_id", body.trajet_instance_id)
    .eq("statut", "pending");

  if (p1Err) throw new Error(`P1 query failed: ${p1Err.message}`);

  const p1 = (p1Raw ?? []) as ReservationRow[];

  if (p1.length > 0) {
    await Promise.all(p1.map((r) => notifyPassager(client, r.passager_id, pushPayload)));
    return { notified: p1.length };
  }

  // 3. Priorité 2 : passagers pending sur autre trajet du même culte/date
  //    sans réponse depuis 1h+
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Deux requêtes séquentielles (pas de sous-requête dans le SDK JS)
  const { data: trajetsSameCulteRaw } = await client
    .from("trajets")
    .select("id")
    .eq("culte_id", culteId);

  const trajetIds = (trajetsSameCulteRaw ?? []).map((t: { id: string }) => t.id);

  if (trajetIds.length === 0) return { notified: 0 };

  const { data: instancesSameDayRaw2, error: id2Err } = await client
    .from("trajets_instances")
    .select("id")
    .eq("date", instanceDate)
    .neq("id", body.trajet_instance_id)
    .in("trajet_id", trajetIds);

  if (id2Err) throw new Error(`P2 instances query failed: ${id2Err.message}`);

  const otherInstanceIds = (instancesSameDayRaw2 ?? []).map((i: { id: string }) => i.id);
  if (otherInstanceIds.length === 0) return { notified: 0 };

  const { data: p2Raw, error: p2Err } = await client
    .from("reservations")
    .select("id, passager_id, demande_le")
    .in("trajet_instance_id", otherInstanceIds)
    .eq("statut", "pending")
    .lt("demande_le", oneHourAgo);

  if (p2Err) throw new Error(`P2 reservations query failed: ${p2Err.message}`);

  const p2 = (p2Raw ?? []) as ReservationRow[];

  if (p2.length > 0) {
    await Promise.all(p2.map((r) => notifyPassager(client, r.passager_id, pushPayload)));
  }

  return { notified: p2.length };
};

Deno.serve(async (req: Request): Promise<Response> => {
  // Vérification Authorization (service_role only)
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.trajet_instance_id || !body.sens) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const result = await run(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[empty-seat-alert] error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
