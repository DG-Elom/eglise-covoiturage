// Edge Function: weekly-digest
// Envoie un digest hebdomadaire à TOUS les utilisateurs actifs pour les ramener vers l'app avant le culte.
// Idempotent via engagement_log (1 seul digest par semaine ISO et par user).
// Déclenchée par pg_cron chaque jeudi 16h00 UTC.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderDigestPassager,
  renderDigestConducteurSansTrajet,
  renderDigestConducteurAvecTrajet,
  sendResend,
} from "./_email.ts";
import { getDailyVerse } from "../reminders/_bible.ts";
import { getIsoWeekKey, chooseCta, buildSmsBody, type UserRole } from "./_utils.ts";

const FROM_EMAIL = Deno.env.get("REMINDERS_FROM_EMAIL") ?? "Covoiturage <noreply@covoiturage.local>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.icc-covoit.fr";
const INTERNAL_PUSH_SECRET = Deno.env.get("INTERNAL_PUSH_SECRET") ?? "";
// Flag SMS : désactivé par défaut, activer via WEEKLY_DIGEST_SMS=1
const SMS_ENABLED = Deno.env.get("WEEKLY_DIGEST_SMS") === "1";
// Test ciblé : si défini, n'envoie qu'à cet user_id (rodage avant envoi général). Vide = tout le monde.
const ONLY_USER = Deno.env.get("WEEKLY_DIGEST_ONLY_USER")?.trim() ?? "";

interface RunSummary {
  sent: number;
  skipped: number;
  errors: number;
}

interface ProfileRow {
  id: string;
  prenom: string;
  role: UserRole;
}

interface WeeklyContext {
  nbInstancesAVenir: number;
  nbPlacesLibres: number;
  nextDate: string | null;
}

// ── Helpers idempotence ──────────────────────────────────────────────────────

const alreadySent = async (
  client: SupabaseClient,
  userId: string,
  kind: string,
): Promise<boolean> => {
  const { data, error } = await client
    .from("engagement_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[weekly-digest] alreadySent error", error);
    return false;
  }
  return !!data;
};

const logSent = async (
  client: SupabaseClient,
  userId: string,
  kind: string,
): Promise<void> => {
  const { error } = await client.from("engagement_log").insert({ user_id: userId, kind });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error("[weekly-digest] logSent error", error);
  }
};

// ── Préférences ──────────────────────────────────────────────────────────────

const prefersEngagement = async (
  client: SupabaseClient,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await client
    .from("notification_preferences")
    .select("engagement_relance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return true; // opt-in par défaut si pas de ligne
  return data.engagement_relance !== false;
};

// ── Email ────────────────────────────────────────────────────────────────────

const fetchEmail = async (
  client: SupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
};

// ── Push interne ─────────────────────────────────────────────────────────────

const sendInternalPush = async (
  userId: string,
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
      body: JSON.stringify({ userId, kind: "engagement", payload: { title, body, url } }),
    });
  } catch (e) {
    console.warn("[weekly-digest] push interne échoué", e);
  }
};

// ── SMS interne ───────────────────────────────────────────────────────────────

const sendInternalSms = async (
  userId: string,
  smsBody: string,
  dedupKey: string,
): Promise<void> => {
  if (!SMS_ENABLED || !INTERNAL_PUSH_SECRET) return;
  try {
    await fetch(`${APP_URL}/api/internal/send-sms`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": INTERNAL_PUSH_SECRET,
      },
      body: JSON.stringify({ userId, kind: "weekly_digest", body: smsBody, dedupKey }),
    });
  } catch (e) {
    console.warn("[weekly-digest] SMS interne échoué", e);
  }
};

// ── Contexte hebdo ───────────────────────────────────────────────────────────

const fetchWeeklyContext = async (client: SupabaseClient): Promise<WeeklyContext> => {
  const today = new Date().toISOString().slice(0, 10);

  const { data: instances, count } = await client
    .from("trajets_instances")
    .select("id, date, trajet:trajets!inner(places_total)", { count: "exact" })
    .gte("date", today)
    .eq("annule_par_conducteur", false);

  const nbInstancesAVenir = count ?? 0;

  // Places libres = places_total - reservations accepted par instance
  let nbPlacesLibres = 0;
  const rows = (instances ?? []) as Array<{
    id: string;
    date: string;
    trajet: { places_total: number } | null;
  }>;

  if (rows.length > 0) {
    const instanceIds = rows.map((r) => r.id);
    const { data: resaData } = await client
      .from("reservations")
      .select("trajet_instance_id")
      .in("trajet_instance_id", instanceIds)
      .eq("statut", "accepted");

    const resaByInstance = new Map<string, number>();
    for (const r of (resaData ?? []) as Array<{ trajet_instance_id: string }>) {
      resaByInstance.set(r.trajet_instance_id, (resaByInstance.get(r.trajet_instance_id) ?? 0) + 1);
    }

    for (const row of rows) {
      const placesTotal = row.trajet?.places_total ?? 0;
      const accepted = resaByInstance.get(row.id) ?? 0;
      nbPlacesLibres += Math.max(0, placesTotal - accepted);
    }
  }

  const nextDate = rows.length > 0
    ? rows.sort((a, b) => a.date.localeCompare(b.date))[0].date
    : null;

  return { nbInstancesAVenir, nbPlacesLibres, nextDate };
};

// ── Traitement d'un profil ────────────────────────────────────────────────────

const processProfile = async (
  client: SupabaseClient,
  profile: ProfileRow,
  weeklyCtx: WeeklyContext,
  weekKind: string,
  summary: RunSummary,
  verset: ReturnType<typeof getDailyVerse>,
): Promise<void> => {
  // 1. Idempotence : déjà envoyé cette semaine ?
  const skip = await alreadySent(client, profile.id, weekKind);
  if (skip) {
    summary.skipped++;
    return;
  }

  // 2. Préférences : a-t-il désactivé les relances ?
  const wantNotif = await prefersEngagement(client, profile.id);
  if (!wantNotif) {
    summary.skipped++;
    return;
  }

  // 3. Récupère l'email
  const email = await fetchEmail(client, profile.id);
  if (!email) {
    summary.errors++;
    return;
  }

  // 4. Le conducteur a-t-il un trajet actif pour cette période ?
  let hasActiveTrajet = false;
  if (profile.role === "conducteur" || profile.role === "les_deux") {
    const today = new Date().toISOString().slice(0, 10);
    const sevenDaysOut = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { count } = await client
      .from("trajets_instances")
      .select("id", { count: "exact", head: true })
      .eq("annule_par_conducteur", false)
      .gte("date", today)
      .lte("date", sevenDaysOut)
      .in(
        "trajet_id",
        (
          await client
            .from("trajets")
            .select("id")
            .eq("conducteur_id", profile.id)
            .eq("actif", true)
        ).data?.map((t: { id: string }) => t.id) ?? [],
      );
    hasActiveTrajet = (count ?? 0) > 0;
  }

  const cta = chooseCta({ role: profile.role, hasActiveTrajet });
  const ctxForEmail = {
    nbInstancesAVenir: weeklyCtx.nbInstancesAVenir,
    nbPlacesLibres: weeklyCtx.nbPlacesLibres,
    nextDate: weeklyCtx.nextDate,
  };

  try {
    // Email
    let emailResult: { subject: string; html: string };
    if (profile.role === "passager") {
      emailResult = renderDigestPassager(profile.prenom, ctxForEmail, verset, APP_URL);
    } else if (hasActiveTrajet) {
      emailResult = renderDigestConducteurAvecTrajet(profile.prenom, ctxForEmail, verset, APP_URL);
    } else {
      emailResult = renderDigestConducteurSansTrajet(profile.prenom, ctxForEmail, verset, APP_URL);
    }

    await sendResend(RESEND_API_KEY, FROM_EMAIL, email, emailResult.subject, emailResult.html);

    // Marque comme envoyé (avant push/sms pour éviter les doublons même si push échoue)
    await logSent(client, profile.id, weekKind);

    // Push
    await sendInternalPush(
      profile.id,
      emailResult.subject.replace(/^[^\s]+\s/, ""), // retire l'emoji initial
      cta.message,
      `${APP_URL}${cta.url}`,
    );

    // SMS (flag WEEKLY_DIGEST_SMS=1 requis)
    if (SMS_ENABLED) {
      const smsBody = buildSmsBody({
        prenom: profile.prenom,
        role: profile.role,
        hasActiveTrajet,
        appUrl: APP_URL,
        nbPlacesLibres: weeklyCtx.nbPlacesLibres,
        nextDate: weeklyCtx.nextDate ?? new Date().toISOString().slice(0, 10),
      });
      await sendInternalSms(profile.id, smsBody, `${weekKind}:${profile.id}`);
    }

    summary.sent++;
  } catch (e) {
    console.error(`[weekly-digest] erreur envoi pour ${profile.id}`, e);
    summary.errors++;
  }
};

// ── Entrypoint ────────────────────────────────────────────────────────────────

const run = async (): Promise<RunSummary> => {
  const summary: RunSummary = { sent: 0, skipped: 0, errors: 0 };

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY missing");
  }

  const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const weekKind = getIsoWeekKey(now);
  const verset = getDailyVerse(now);
  const weeklyCtx = await fetchWeeklyContext(client);

  // Récupère tous les utilisateurs actifs (suspended=false, charte signée)
  // ONLY_USER restreint au rodage (un seul destinataire) si l'env est défini.
  let profilesQuery = client
    .from("profiles")
    .select("id, prenom, role")
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null);
  if (ONLY_USER) {
    profilesQuery = profilesQuery.eq("id", ONLY_USER);
  }
  const { data: profilesRaw, error } = await profilesQuery;

  if (error) {
    throw new Error(`Erreur récupération profiles: ${error.message}`);
  }

  const profiles = (profilesRaw ?? []) as ProfileRow[];

  for (const profile of profiles) {
    await processProfile(client, profile, weeklyCtx, weekKind, summary, verset);
  }

  return summary;
};

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    const summary = await run();
    return new Response(
      JSON.stringify({ sent: summary.sent, skipped: summary.skipped, errors: summary.errors }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[weekly-digest] run failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
