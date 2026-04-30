// Edge Function: weekly-summary
// Génère le résumé hebdomadaire IA et l'envoie par email aux admins (dimanche 18h).
// Déclenchée par pg_cron (voir commande SQL dans scratchpad/D-report.md).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderWeeklySummaryEmail, sendResend } from "./_email.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("WEEKLY_FROM_EMAIL") ?? "Covoiturage <noreply@covoiturage.local>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const KM_MOYEN_PAR_TRAJET = 20;
const CO2_KG_PAR_KM_PAR_PASSAGER = 0.12;

function sevenDaysAgo(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}

function semaineDuLabel(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}`;
}

function buildPrompt(stats: {
  trajetsEffectues: number;
  passagersTransportes: number;
  nouveauxInscrits: number;
  messagesEchanges: number;
  kmCumules: number;
  co2EconomiseKg: number;
}): string {
  return `Rédige un message court (~80 mots), chaleureux, pour la communauté ICC Metz, à partir des stats suivantes. Format adapté à WhatsApp (emojis modérés). Termine par une phrase d'encouragement biblique légère.

Stats de la semaine :
- Trajets effectués : ${stats.trajetsEffectues}
- Passagers transportés : ${stats.passagersTransportes}
- Nouveaux inscrits : ${stats.nouveauxInscrits}
- Messages échangés : ${stats.messagesEchanges}
- Km cumulés estimés : ${stats.kmCumules}
- CO2 économisé estimé : ${stats.co2EconomiseKg} kg`;
}

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Réponse Gemini vide");
  return text.trim();
}

const run = async (): Promise<{ sent: number; errors: number }> => {
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY manquant");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquant");

  const client = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const since = sevenDaysAgo();

  // Stats hebdo
  const [
    { count: trajetsEffectues },
    { count: passagersTransportes },
    { count: nouveauxInscrits },
    { count: messagesEchanges },
  ] = await Promise.all([
    client
      .from("trajets_instances")
      .select("id", { count: "exact", head: true })
      .eq("annule_par_conducteur", false)
      .gte("date", since.slice(0, 10)),
    client
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "completed")
      .gte("demande_le", since),
    client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .gte("envoye_le", since),
  ]);

  const kmCumules = (trajetsEffectues ?? 0) * KM_MOYEN_PAR_TRAJET;
  const co2EconomiseKg =
    Math.round(kmCumules * CO2_KG_PAR_KM_PAR_PASSAGER * (passagersTransportes ?? 0) * 100) / 100;

  const stats = {
    trajetsEffectues: trajetsEffectues ?? 0,
    passagersTransportes: passagersTransportes ?? 0,
    nouveauxInscrits: nouveauxInscrits ?? 0,
    messagesEchanges: messagesEchanges ?? 0,
    kmCumules,
    co2EconomiseKg,
  };

  const messageCommunaute = await callGemini(buildPrompt(stats));

  // Récupère tous les admins
  const { data: admins, error: adminsErr } = await client
    .from("profiles")
    .select("id")
    .eq("is_admin", true);

  if (adminsErr || !admins) throw new Error("Erreur récupération admins");

  const semaineDu = semaineDuLabel();
  const { subject, html } = renderWeeklySummaryEmail({
    semaineDu,
    ...stats,
    messageCommunaute,
  });

  let sent = 0;
  let errors = 0;

  for (const admin of admins) {
    try {
      const { data: authUser, error: authErr } = await client.auth.admin.getUserById(admin.id);
      if (authErr || !authUser?.user?.email) {
        errors++;
        continue;
      }
      await sendResend(RESEND_API_KEY, FROM_EMAIL, authUser.user.email, subject, html);
      sent++;
    } catch (e) {
      console.error("Erreur envoi email admin", admin.id, e);
      errors++;
    }
  }

  return { sent, errors };
};

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    const result = await run();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("weekly-summary run failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
