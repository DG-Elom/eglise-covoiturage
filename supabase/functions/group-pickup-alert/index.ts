// Edge Function: group-pickup-alert
// Cron toutes les 30 min (pg_cron → pg_net).
//
// Logique :
//   1. Récupère les reservations pending créées il y a > 1h, sans trajet confirmé.
//   2. Groupe par (trajet_instance_id) avec clustering géographique des pickup_position
//      (rayon 1 km via haversine — pas de PostGIS ici, calcul TS).
//   3. Pour chaque cluster >= 3 passagers :
//      a. Calcule le centroïde du cluster.
//      b. Trouve les conducteurs non-suspendus dans un rayon de 3 km du centroïde
//         qui n'ont pas de trajet pour cette instance (date + culte).
//      c. Push "3 fidèles du quartier cherchent un trajet pour {culte} {date}".
//      d. Log dans group_alerts_log (idempotence via unique(conducteur_id, cluster_key)).

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")              ?? "";
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const APP_URL           = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://covoiturage.local";

// ---- Geo helpers (dupliqués ici car Deno edge functions sont isolées) ----

type GeoPoint = { lat: number; lng: number };

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const chord =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng *
      sinDLng;
  return R * 2 * Math.asin(Math.sqrt(chord));
}

function clusterByDistance<T extends GeoPoint>(points: T[], radiusKm: number): T[][] {
  if (points.length === 0) return [];

  const clusterOf = new Array<number>(points.length).fill(-1);
  let nextCluster = 0;

  for (let i = 0; i < points.length; i++) {
    if (clusterOf[i] !== -1) continue;
    clusterOf[i] = nextCluster;
    for (let j = i + 1; j < points.length; j++) {
      if (clusterOf[j] !== -1) continue;
      if (haversineKm(points[i], points[j]) <= radiusKm) {
        clusterOf[j] = nextCluster;
      }
    }
    nextCluster++;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (clusterOf[i] !== clusterOf[j] && haversineKm(points[i], points[j]) <= radiusKm) {
          const keep = Math.min(clusterOf[i], clusterOf[j]);
          clusterOf[i] = keep;
          clusterOf[j] = keep;
          changed = true;
        }
      }
    }
  }

  const map = new Map<number, T[]>();
  for (let i = 0; i < points.length; i++) {
    const c = clusterOf[i];
    if (!map.has(c)) map.set(c, []);
    map.get(c)!.push(points[i]);
  }

  return Array.from(map.values());
}

function centroid(points: GeoPoint[]): GeoPoint {
  const lat = points.reduce((acc, p) => acc + p.lat, 0) / points.length;
  const lng = points.reduce((acc, p) => acc + p.lng, 0) / points.length;
  return { lat, lng };
}

/** cluster_key : hash déterministe basé sur instance_id + centroïde arrondi à 3 décimales (~100m). */
function clusterKey(instanceId: string, center: GeoPoint): string {
  const latR = Math.round(center.lat * 1000);
  const lngR = Math.round(center.lng * 1000);
  return `${instanceId}|${latR}|${lngR}`;
}

// ---- Push ----

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendWebPush(sub: SubRow, payload: object): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const webpush = await import("https://esm.sh/web-push@3.6.7");
  webpush.default.setVapidDetails("mailto:no-reply@eglise.app", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  await webpush.default.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  );
}

async function pushToConducteur(
  client: SupabaseClient,
  conducteurId: string,
  payload: object,
): Promise<void> {
  const { data: subs } = await client
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", conducteurId);

  if (!subs || subs.length === 0) return;

  await Promise.all(
    (subs as SubRow[]).map(async (sub) => {
      try {
        await sendWebPush(sub, payload);
      } catch (err) {
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

// ---- Types ----

interface ReservationPendingRow {
  id: string;
  passager_id: string;
  trajet_instance_id: string;
  pickup_position: { coordinates: [number, number] }; // GeoJSON [lng, lat]
  demande_le: string;
  trajet_instance: {
    date: string;
    trajet: {
      culte_id: string;
      culte: { libelle: string } | null;
    } | null;
  } | null;
}

// ---- Core ----

interface RunSummary {
  clusters_found: number;
  conducteurs_alerted: number;
  skipped_already_sent: number;
}

const run = async (): Promise<RunSummary> => {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const summary: RunSummary = {
    clusters_found: 0,
    conducteurs_alerted: 0,
    skipped_already_sent: 0,
  };

  // 1. Réservations pending > 1h, avec infos instance + trajet + culte
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: rawReservations, error: resErr } = await client
    .from("reservations")
    .select(`
      id, passager_id, trajet_instance_id, pickup_position, demande_le,
      trajet_instance:trajets_instances!inner (
        date,
        trajet:trajets!inner (
          culte_id,
          culte:cultes!inner ( libelle )
        )
      )
    `)
    .eq("statut", "pending")
    .lt("demande_le", oneHourAgo);

  if (resErr) throw new Error(`Reservations query failed: ${resErr.message}`);

  const reservations = (rawReservations ?? []) as unknown as ReservationPendingRow[];

  // 2. Grouper par trajet_instance_id
  const byInstance = new Map<string, ReservationPendingRow[]>();
  for (const r of reservations) {
    const list = byInstance.get(r.trajet_instance_id) ?? [];
    list.push(r);
    byInstance.set(r.trajet_instance_id, list);
  }

  for (const [instanceId, resas] of byInstance) {
    const instanceInfo = resas[0].trajet_instance;
    if (!instanceInfo) continue;

    const culteId      = instanceInfo.trajet?.culte_id ?? "";
    const culteLibelle = instanceInfo.trajet?.culte?.libelle ?? "culte";
    const instanceDate = instanceInfo.date;

    // Convertir les pickup_position GeoJSON en GeoPoint
    type PointWithMeta = GeoPoint & { reservationId: string; passagerId: string };
    const points: PointWithMeta[] = resas
      .map((r) => {
        const coords = r.pickup_position?.coordinates;
        if (!coords || coords.length < 2) return null;
        return {
          lng: coords[0],
          lat: coords[1],
          reservationId: r.id,
          passagerId: r.passager_id,
        };
      })
      .filter((p): p is PointWithMeta => p !== null);

    if (points.length === 0) continue;

    // 3. Clustering 1 km
    const clusters = clusterByDistance(points, 1);

    for (const cluster of clusters) {
      if (cluster.length < 3) continue;

      summary.clusters_found++;

      const center   = centroid(cluster);
      const key      = clusterKey(instanceId, center);
      const nbPassagers = cluster.length;

      // 4. Trouver conducteurs dans rayon 3 km, sans trajet pour ce culte/date
      // a. Récupérer les trajets déjà existants pour ce culte/date
      const { data: trajetsExistants } = await client
        .from("trajets_instances")
        .select("trajet_id")
        .eq("date", instanceDate)
        .in("trajet_id",
          // sous-requête : trajets du même culte
          (await client.from("trajets").select("id").eq("culte_id", culteId)).data?.map(
            (t: { id: string }) => t.id,
          ) ?? [],
        );

      const conducteursBusy = new Set<string>();
      if (trajetsExistants && trajetsExistants.length > 0) {
        const trajetIds = trajetsExistants.map((ti: { trajet_id: string }) => ti.trajet_id);
        const { data: trajetsConducteurs } = await client
          .from("trajets")
          .select("conducteur_id")
          .in("id", trajetIds);
        for (const t of trajetsConducteurs ?? []) {
          conducteursBusy.add((t as { conducteur_id: string }).conducteur_id);
        }
      }

      // b. Conducteurs actifs avec position de départ dans 3 km
      // On récupère tous les conducteurs non-suspendus et on filtre en TS
      // (pas de st_dwithin disponible sans pg depuis l'edge function)
      const { data: conducteurs } = await client
        .from("trajets")
        .select("conducteur_id, depart_position")
        .eq("actif", true)
        .neq("culte_id", ""); // tous les trajets actifs pour récupérer leurs conducteurs

      // Dédupliquer par conducteur_id
      const conducteurMap = new Map<string, { lat: number; lng: number }>();
      for (const t of conducteurs ?? []) {
        const row = t as { conducteur_id: string; depart_position: { coordinates: [number, number] } | null };
        if (!row.depart_position || conducteursBusy.has(row.conducteur_id)) continue;
        const coords = row.depart_position.coordinates;
        if (!coords || coords.length < 2) continue;
        conducteurMap.set(row.conducteur_id, { lat: coords[1], lng: coords[0] });
      }

      // Filtrer par rayon 3 km et suspended = false
      const conducteursDansRayon: string[] = [];
      for (const [conducteurId, pos] of conducteurMap) {
        if (haversineKm(center, pos) <= 3) {
          conducteursDansRayon.push(conducteurId);
        }
      }

      if (conducteursDansRayon.length === 0) continue;

      // Vérifier suspended
      const { data: profilesData } = await client
        .from("profiles")
        .select("id, suspended")
        .in("id", conducteursDansRayon)
        .eq("suspended", false)
        .in("role", ["conducteur", "les_deux"]);

      const eligibles = (profilesData ?? []).map((p: { id: string }) => p.id);

      for (const conducteurId of eligibles) {
        // 5. Idempotence : vérifier si déjà envoyé
        const { data: existing } = await client
          .from("group_alerts_log")
          .select("id")
          .eq("conducteur_id", conducteurId)
          .eq("cluster_key", key)
          .maybeSingle();

        if (existing) {
          summary.skipped_already_sent++;
          continue;
        }

        // 6. Push notification
        const pushPayload = {
          title: "Co-voiturage groupé",
          body:  `${nbPassagers} fidèles du quartier cherchent un trajet pour ${culteLibelle} le ${instanceDate}. Tu pourrais les emmener ?`,
          url:   `${APP_URL}/dashboard`,
        };

        await pushToConducteur(client, conducteurId, pushPayload);

        // 7. Log pour idempotence
        const { error: logErr } = await client.from("group_alerts_log").insert({
          conducteur_id: conducteurId,
          cluster_key:   key,
        });

        if (logErr && !logErr.message.toLowerCase().includes("duplicate")) {
          console.error("[group-pickup-alert] log insert error", logErr);
        } else {
          summary.conducteurs_alerted++;
        }
      }
    }
  }

  return summary;
};

Deno.serve(async (req: Request): Promise<Response> => {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const result = await run();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[group-pickup-alert] error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
