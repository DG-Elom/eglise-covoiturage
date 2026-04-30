import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { computeWeeklyStats, type WeeklyRawData } from "./_stats";

export const runtime = "nodejs";

function sevenDaysAgo(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString();
}

function buildSummaryPrompt(stats: ReturnType<typeof computeWeeklyStats>): string {
  return `Rédige un message court (~80 mots), chaleureux, pour la communauté ICC Metz, à partir des stats suivantes. Format adapté à WhatsApp (emojis modérés). Termine par une phrase d'encouragement biblique légère.

Stats de la semaine :
- Trajets effectués : ${stats.trajetsEffectues}
- Passagers transportés : ${stats.passagersTransportes}
- Nouveaux inscrits : ${stats.nouveauxInscrits}
- Messages échangés : ${stats.messagesEchanges}
- Km cumulés estimés : ${stats.kmCumules}
- CO2 économisé estimé : ${stats.co2EconomiseKg} kg`;
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérifie que l'utilisateur est admin
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile?.is_admin) {
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  }

  const since = sevenDaysAgo();

  // Trajets effectués sur 7 jours (instances non annulées)
  const { count: trajetsEffectues } = await supabase
    .from("trajets_instances")
    .select("id", { count: "exact", head: true })
    .eq("annule_par_conducteur", false)
    .gte("date", since.slice(0, 10));

  // Passagers transportés (réservations completed)
  const { count: passagersTransportes } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("statut", "completed")
    .gte("demande_le", since);

  // Nouveaux inscrits
  const { count: nouveauxInscrits } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  // Messages échangés
  const { count: messagesEchanges } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("envoye_le", since);

  // Estimation km : trajets effectués × distance moyenne estimée (20 km)
  const KM_MOYEN_PAR_TRAJET = 20;
  const kmCumules = (trajetsEffectues ?? 0) * KM_MOYEN_PAR_TRAJET;

  const raw: WeeklyRawData = {
    trajetsEffectues: trajetsEffectues ?? 0,
    passagersTransportes: passagersTransportes ?? 0,
    nouveauxInscrits: nouveauxInscrits ?? 0,
    messagesEchanges: messagesEchanges ?? 0,
    kmCumules,
  };

  const stats = computeWeeklyStats(raw);
  const prompt = buildSummaryPrompt(stats);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
    });

    const message = result.text?.trim();
    if (!message) {
      return NextResponse.json({ error: "Réponse inattendue du modèle" }, { status: 500 });
    }

    return NextResponse.json({ stats, message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
