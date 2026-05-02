// Edge Function: engage-inactive-passengers
// Relance (push + email) les passagers inscrits qui n'ont jamais réservé.
// 3 paliers : J+2, J+7, J+14. Arrêt après J+28. Idempotent via engagement_log.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderEngageD2,
  renderEngageD7,
  renderEngageD14,
  renderEngageConducteurD2,
  renderEngageConducteurD7,
  renderEngageConducteurD14,
  sendResend,
  type StatsHebdoConducteur,
} from "./_email.ts";
import { getDailyVerse } from "../reminders/_bible.ts";

const FROM_EMAIL = Deno.env.get("REMINDERS_FROM_EMAIL") ?? "Covoiturage <noreply@covoiturage.local>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://app.icc-covoit.fr";
const INTERNAL_PUSH_SECRET = Deno.env.get("INTERNAL_PUSH_SECRET") ?? "";

type EngageKind = "engage_d2" | "engage_d7" | "engage_d14";
type ConducteurEngageKind =
  | "engage_conducteur_d2"
  | "engage_conducteur_d7"
  | "engage_conducteur_d14";

interface ProfileRow {
  id: string;
  prenom: string;
  charte_acceptee_at: string;
  age_jours: number;
}

interface StatsHebdo {
  nbConducteursActifs: number;
  nbTrajetsDispo: number;
  nbPassagersTransportes: number;
}

interface RunSummary {
  sent: number;
  skipped: number;
  errors: number;
}

function chooseKind(ageJours: number): EngageKind | null {
  if (ageJours >= 2 && ageJours < 7) return "engage_d2";
  if (ageJours >= 7 && ageJours < 14) return "engage_d7";
  if (ageJours >= 14 && ageJours < 28) return "engage_d14";
  return null;
}

function chooseConducteurKind(ageJours: number): ConducteurEngageKind | null {
  if (ageJours >= 2 && ageJours < 7) return "engage_conducteur_d2";
  if (ageJours >= 7 && ageJours < 14) return "engage_conducteur_d7";
  if (ageJours >= 14 && ageJours < 28) return "engage_conducteur_d14";
  return null;
}

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
      body: JSON.stringify({ userId, kind: "engagement", payload: { title, body, url } }),
    });
  } catch (e) {
    console.warn("[engage] push interne échoué", e);
  }
};

const fetchEmail = async (
  client: SupabaseClient,
  userId: string,
): Promise<string | null> => {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error || !data?.user?.email) return null;
  return data.user.email;
};

const alreadySent = async (
  client: SupabaseClient,
  userId: string,
  kind: EngageKind,
): Promise<boolean> => {
  const { data, error } = await client
    .from("engagement_log")
    .select("id")
    .eq("user_id", userId)
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
  userId: string,
  kind: EngageKind,
): Promise<void> => {
  const { error } = await client.from("engagement_log").insert({ user_id: userId, kind });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error("logSent error", error);
  }
};

const prefersEngagement = async (
  client: SupabaseClient,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await client
    .from("notification_preferences")
    .select("engagement_relance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return true; // pas de prefs → opt-in par défaut
  return data.engagement_relance !== false;
};

const fetchWeeklyStats = async (client: SupabaseClient): Promise<StatsHebdo> => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: conducteurs } = await client
    .from("trajets_instances")
    .select("trajet:trajets!inner(conducteur_id)", { count: "exact" })
    .gte("date", oneWeekAgo.slice(0, 10))
    .eq("annule_par_conducteur", false);

  const uniqueConducteurs = new Set(
    (conducteurs ?? []).map((r: any) => (r.trajet as any)?.conducteur_id).filter(Boolean),
  );

  const { count: nbTransportes } = await client
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("statut", "accepted")
    .gte("created_at", oneWeekAgo);

  const { count: nbDispo } = await client
    .from("trajets_instances")
    .select("*", { count: "exact", head: true })
    .gte("date", new Date().toISOString().slice(0, 10))
    .eq("annule_par_conducteur", false);

  return {
    nbConducteursActifs: uniqueConducteurs.size,
    nbTrajetsDispo: nbDispo ?? 0,
    nbPassagersTransportes: nbTransportes ?? 0,
  };
};

const alreadySentConducteur = async (
  client: SupabaseClient,
  userId: string,
  kind: ConducteurEngageKind,
): Promise<boolean> => {
  const { data, error } = await client
    .from("engagement_log")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("alreadySentConducteur error", error);
    return false;
  }
  return !!data;
};

const logSentConducteur = async (
  client: SupabaseClient,
  userId: string,
  kind: ConducteurEngageKind,
): Promise<void> => {
  const { error } = await client.from("engagement_log").insert({ user_id: userId, kind });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    console.error("logSentConducteur error", error);
  }
};

const computeWeeklyContext = async (client: SupabaseClient): Promise<StatsHebdoConducteur> => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Passagers inscrits cette semaine sans aucune réservation
  const { data: newPassagers } = await client
    .from("profiles")
    .select("id")
    .in("role", ["passager", "les_deux"])
    .eq("suspended", false)
    .gte("charte_acceptee_at", oneWeekAgo);

  let nbPassagersInscritsSansResa = 0;
  if ((newPassagers ?? []).length > 0) {
    const ids = (newPassagers ?? []).map((p: { id: string }) => p.id);
    const { data: avecResa } = await client
      .from("reservations")
      .select("passager_id")
      .in("passager_id", ids);
    const idsAvecResa = new Set((avecResa ?? []).map((r: { passager_id: string }) => r.passager_id));
    nbPassagersInscritsSansResa = ids.filter((id: string) => !idsAvecResa.has(id)).length;
  }

  const { count: nbDemandesPending } = await client
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("statut", "pending");

  return {
    nbPassagersInscritsSansResa,
    nbDemandesPending: nbDemandesPending ?? 0,
  };
};

interface ConducteurProfileRow {
  id: string;
  prenom: string;
  charte_acceptee_at: string;
  age_jours: number;
}

const processConducteurProfile = async (
  client: SupabaseClient,
  profile: ConducteurProfileRow,
  weeklyCtx: StatsHebdoConducteur,
  summary: RunSummary,
  verset: ReturnType<typeof getDailyVerse>,
): Promise<void> => {
  const kind = chooseConducteurKind(profile.age_jours);
  if (!kind) {
    summary.skipped++;
    return;
  }

  const skip = await alreadySentConducteur(client, profile.id, kind);
  if (skip) {
    summary.skipped++;
    return;
  }

  const wantEmail = await prefersEngagement(client, profile.id);
  if (!wantEmail) {
    summary.skipped++;
    return;
  }

  const email = await fetchEmail(client, profile.id);
  if (!email) {
    summary.errors++;
    return;
  }

  try {
    let subject: string;
    let html: string;
    let pushTitle: string;
    let pushBody: string;

    if (kind === "engage_conducteur_d2") {
      ({ subject, html } = renderEngageConducteurD2(profile.prenom));
      pushTitle = "🚗 Propose un trajet vers le culte";
      pushBody = "30 secondes pour aider la communauté";
    } else if (kind === "engage_conducteur_d7") {
      ({ subject, html } = renderEngageConducteurD7(profile.prenom, weeklyCtx));
      pushTitle = `🙏 ${weeklyCtx.nbPassagersInscritsSansResa} fidèles attendent un conducteur`;
      pushBody = "Tu peux les emmener au culte ?";
    } else {
      ({ subject, html } = renderEngageConducteurD14(profile.prenom, verset));
      pushTitle = "🚗 La communauté a besoin de toi";
      pushBody = "Propose un trajet ou change ton rôle passager si besoin";
    }

    await sendResend(RESEND_API_KEY, FROM_EMAIL, email, subject, html);
    await logSentConducteur(client, profile.id, kind);
    await sendInternalPush(
      profile.id,
      kind,
      pushTitle,
      pushBody,
      "/trajets/nouveau",
    );
    summary.sent++;
  } catch (e) {
    console.error(`[engage-conducteur] erreur envoi ${kind} pour ${profile.id}`, e);
    summary.errors++;
  }
};

const processProfile = async (
  client: SupabaseClient,
  profile: ProfileRow,
  stats: StatsHebdo,
  summary: RunSummary,
  verset: ReturnType<typeof getDailyVerse>,
): Promise<void> => {
  const kind = chooseKind(profile.age_jours);
  if (!kind) {
    summary.skipped++;
    return;
  }

  const skip = await alreadySent(client, profile.id, kind);
  if (skip) {
    summary.skipped++;
    return;
  }

  const wantEmail = await prefersEngagement(client, profile.id);
  if (!wantEmail) {
    summary.skipped++;
    return;
  }

  const email = await fetchEmail(client, profile.id);
  if (!email) {
    summary.errors++;
    return;
  }

  try {
    let subject: string;
    let html: string;
    let pushTitle: string;
    let pushBody: string;

    if (kind === "engage_d2") {
      ({ subject, html } = renderEngageD2(profile.prenom));
      pushTitle = "👋 Tu as essayé l'app ?";
      pushBody = "Trouver un trajet vers le culte prend 30 secondes.";
    } else if (kind === "engage_d7") {
      ({ subject, html } = renderEngageD7(profile.prenom, stats));
      pushTitle = `🚗 ${stats.nbConducteursActifs} conducteurs cette semaine`;
      pushBody = `${stats.nbTrajetsDispo} trajets vers ICC, va voir.`;
    } else {
      ({ subject, html } = renderEngageD14(profile.prenom, verset));
      pushTitle = "📍 Ta place dimanche ?";
      pushBody = "Dernier rappel, on est là si tu as une difficulté.";
    }

    await sendResend(RESEND_API_KEY, FROM_EMAIL, email, subject, html);
    await logSent(client, profile.id, kind);
    await sendInternalPush(
      profile.id,
      kind,
      pushTitle,
      pushBody,
      "/trajets/recherche",
    );
    summary.sent++;
  } catch (e) {
    console.error(`[engage] erreur envoi ${kind} pour ${profile.id}`, e);
    summary.errors++;
  }
};

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
  const verset = getDailyVerse(now);
  const [stats, weeklyCtx] = await Promise.all([
    fetchWeeklyStats(client),
    computeWeeklyContext(client),
  ]);

  // Traitement conducteurs inactifs (0 trajet actif, charte signée ≥ 2j)
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const { data: conducteursRaw } = await client
    .from("profiles")
    .select("id, prenom, charte_acceptee_at")
    .in("role", ["conducteur", "les_deux"])
    .eq("suspended", false)
    .not("charte_acceptee_at", "is", null)
    .lte("charte_acceptee_at", twoDaysAgo);

  const conducteurProfiles = (conducteursRaw ?? []) as Array<{
    id: string;
    prenom: string;
    charte_acceptee_at: string;
  }>;

  const conducteurCheck = await Promise.all(
    conducteurProfiles.map(async (p) => {
      const { count } = await client
        .from("trajets")
        .select("*", { count: "exact", head: true })
        .eq("conducteur_id", p.id)
        .eq("actif", true);
      return { profile: p, hasTrajet: (count ?? 0) > 0 };
    }),
  );

  const eligibleConducteurs = conducteurCheck
    .filter((r) => !r.hasTrajet)
    .map((r) => {
      const ageMs = now.getTime() - new Date(r.profile.charte_acceptee_at).getTime();
      return { ...r.profile, age_jours: Math.floor(ageMs / (24 * 3600 * 1000)) };
    });

  for (const profile of eligibleConducteurs) {
    await processConducteurProfile(client, profile, weeklyCtx, summary, verset);
  }

  // Récupère tous les passagers éligibles (jamais réservé, charte signée il y a ≥ 2j)
  const { data: profilesRaw, error } = await client.rpc("get_inactive_passengers");

  if (error) {
    // Fallback : requête directe si la fonction RPC n'existe pas encore
    console.warn("[engage] RPC get_inactive_passengers indisponible, fallback SQL direct", error.message);
    const { data: fallbackRaw, error: fallbackErr } = await client
      .from("profiles")
      .select("id, prenom, charte_acceptee_at")
      .in("role", ["passager", "les_deux"])
      .eq("suspended", false)
      .not("charte_acceptee_at", "is", null)
      .lte("charte_acceptee_at", new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString());

    if (fallbackErr) {
      throw fallbackErr;
    }

    const profiles = (fallbackRaw ?? []) as Array<{
      id: string;
      prenom: string;
      charte_acceptee_at: string;
    }>;

    // Filtre ceux qui n'ont jamais réservé (en mémoire - non scalable mais suffisant pour 21 users)
    const reservationCheck = await Promise.all(
      profiles.map(async (p) => {
        const { count } = await client
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .eq("passager_id", p.id);
        return { profile: p, hasReservation: (count ?? 0) > 0 };
      }),
    );

    const eligible = reservationCheck
      .filter((r) => !r.hasReservation)
      .map((r) => {
        const ageMs = now.getTime() - new Date(r.profile.charte_acceptee_at).getTime();
        const age_jours = Math.floor(ageMs / (24 * 3600 * 1000));
        return { ...r.profile, age_jours };
      });

    for (const profile of eligible) {
      await processProfile(client, profile, stats, summary, verset);
    }

    return summary;
  }

  const profiles = (profilesRaw ?? []) as ProfileRow[];
  for (const profile of profiles) {
    await processProfile(client, profile, stats, summary, verset);
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
    console.error("engage-inactive-passengers run failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
