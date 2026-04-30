// Edge Function: imminent-departure
// Envoie une push "départ dans 15 min" aux conducteurs et passagers acceptés
// pour les instances de trajet démarrant dans la fenêtre [now+10min, now+20min].
// Idempotent via reminders_log (kind = imminent_departure_conducteur / imminent_departure).
// Activé par un cron toutes les 5 minutes.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface CulteRow {
  id: string;
  libelle: string;
  heure: string;
}

interface TrajetRow {
  id: string;
  conducteur_id: string;
  heure_depart: string | null;
  culte: CulteRow | null;
}

interface InstanceRow {
  id: string;
  trajet_id: string;
  date: string;
  annule_par_conducteur: boolean;
  trajet: TrajetRow | null;
}

interface ProfileRow {
  id: string;
  prenom: string;
}

interface ReservationRow {
  id: string;
  passager_id: string;
  pickup_adresse: string;
  statut: string;
}

interface RunSummary {
  pushed: number;
  skipped: number;
  errors: number;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.icc-covoit.fr";
const INTERNAL_PUSH_SECRET = Deno.env.get("INTERNAL_PUSH_SECRET") ?? "";
const REMINDERS_TZ = Deno.env.get("REMINDERS_TZ") ?? "Africa/Abidjan";

const pad = (n: number): string => n.toString().padStart(2, "0");

const toUtcMs = (date: string, heure: string): number => {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const targetWallMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);

  let utcMs = targetWallMs;

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDERS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      fmt
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    );
    const tzWallMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour),
      Number(parts.minute),
    );
    const diff = targetWallMs - tzWallMs;
    if (diff === 0) break;
    utcMs += diff;
  }

  return utcMs;
};

const dateRangeForQuery = (now: Date): { dateMin: string; dateMax: string } => {
  const minMs = now.getTime();
  const maxMs = now.getTime() + 60 * 60 * 1000; // +1h de marge
  const fmt = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  return { dateMin: fmt(minMs), dateMax: fmt(maxMs + 24 * 3600 * 1000) };
};

const alreadySent = async (
  client: SupabaseClient,
  trajetInstanceId: string,
  recipientId: string,
  kind: string,
): Promise<boolean> => {
  const { data, error } = await client
    .from("reminders_log")
    .select("id")
    .eq("trajet_instance_id", trajetInstanceId)
    .eq("recipient_id", recipientId)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("alreadySent error", error);
    return false;
  }
  return !!data;
};

const logSent = async (
  client: SupabaseClient,
  trajetInstanceId: string,
  recipientId: string,
  kind: string,
): Promise<void> => {
  const { error } = await client.from("reminders_log").insert({
    trajet_instance_id: trajetInstanceId,
    recipient_id: recipientId,
    kind,
  });
  if (error) {
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      console.error("logSent error", error);
    }
  }
};

const sendInternalPush = async (
  userId: string,
  kind: string,
  title: string,
  body: string,
  url: string,
): Promise<void> => {
  if (!INTERNAL_PUSH_SECRET) return;
  try {
    await fetch(`${APP_URL}/api/internal/send-push`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": INTERNAL_PUSH_SECRET,
      },
      body: JSON.stringify({ userId, kind, payload: { title, body, url } }),
    });
  } catch (e) {
    console.warn("[imminent-departure] push interne échoué", e);
  }
};

const processInstance = async (
  client: SupabaseClient,
  instance: InstanceRow,
  summary: RunSummary,
): Promise<void> => {
  const trajet = instance.trajet;
  if (!trajet || !trajet.heure_depart || !trajet.culte) return;

  const programme = trajet.culte.libelle;

  // Profil conducteur
  const { data: conducteurRaw, error: condErr } = await client
    .from("profiles")
    .select("id, prenom")
    .eq("id", trajet.conducteur_id)
    .single();
  if (condErr || !conducteurRaw) {
    console.error("conducteur fetch error", condErr);
    summary.errors++;
    return;
  }
  const conducteur = conducteurRaw as ProfileRow;

  // Réservations acceptées
  const { data: reservationsRaw, error: resErr } = await client
    .from("reservations")
    .select("id, passager_id, pickup_adresse, statut")
    .eq("trajet_instance_id", instance.id)
    .eq("statut", "accepted");
  if (resErr) {
    console.error("reservations fetch error", resErr);
    summary.errors++;
    return;
  }
  const reservations = (reservationsRaw ?? []) as ReservationRow[];

  // Profils passagers
  const passagerIds = reservations.map((r) => r.passager_id);
  const passagerProfiles = new Map<string, ProfileRow>();
  if (passagerIds.length > 0) {
    const { data: profs, error: profErr } = await client
      .from("profiles")
      .select("id, prenom")
      .in("id", passagerIds);
    if (profErr) {
      console.error("passagers fetch error", profErr);
      summary.errors++;
      return;
    }
    for (const p of (profs ?? []) as ProfileRow[]) passagerProfiles.set(p.id, p);
  }

  // Push conducteur
  const conducteurKind = "imminent_departure_conducteur";
  const skipConducteur = await alreadySent(client, instance.id, conducteur.id, conducteurKind);
  if (skipConducteur) {
    summary.skipped++;
  } else {
    await sendInternalPush(
      conducteur.id,
      "imminent_departure",
      "🚦 Départ dans 15 min",
      `Vérifie ton itinéraire vers ${programme}`,
      "/dashboard",
    );
    await logSent(client, instance.id, conducteur.id, conducteurKind);
    summary.pushed++;
  }

  // Push passagers
  for (const r of reservations) {
    const passagerKind = "imminent_departure";
    const passager = passagerProfiles.get(r.passager_id);
    if (!passager) {
      summary.errors++;
      continue;
    }
    const skipPassager = await alreadySent(client, instance.id, passager.id, passagerKind);
    if (skipPassager) {
      summary.skipped++;
      continue;
    }
    await sendInternalPush(
      passager.id,
      "imminent_departure",
      "🚦 Départ imminent",
      `${conducteur.prenom} arrive bientôt à ${r.pickup_adresse}`,
      "/dashboard",
    );
    await logSent(client, instance.id, passager.id, passagerKind);
    summary.pushed++;
  }
};

const run = async (): Promise<RunSummary> => {
  const summary: RunSummary = { pushed: 0, skipped: 0, errors: 0 };

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const lowerMs = now.getTime() + 10 * 60 * 1000; // +10min
  const upperMs = now.getTime() + 20 * 60 * 1000; // +20min

  const { dateMin, dateMax } = dateRangeForQuery(now);

  const { data: instancesRaw, error } = await client
    .from("trajets_instances")
    .select(
      `id, trajet_id, date, annule_par_conducteur,
       trajet:trajets!inner (
         id, conducteur_id, heure_depart,
         culte:cultes!inner ( id, libelle, heure )
       )`,
    )
    .eq("annule_par_conducteur", false)
    .gte("date", dateMin)
    .lte("date", dateMax);

  if (error) {
    console.error("instances fetch error", error);
    throw error;
  }

  const instances = (instancesRaw ?? []) as unknown as InstanceRow[];

  for (const inst of instances) {
    const trajet = inst.trajet;
    if (!trajet?.heure_depart) continue;
    const startMs = toUtcMs(inst.date, trajet.heure_depart);
    if (startMs >= lowerMs && startMs <= upperMs) {
      await processInstance(client, inst, summary);
    }
  }

  return summary;
};

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    const summary = await run();
    return new Response(
      JSON.stringify({ pushed: summary.pushed, skipped: summary.skipped, errors: summary.errors }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("imminent-departure run failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
