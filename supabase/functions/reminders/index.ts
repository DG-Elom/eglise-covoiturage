// Edge Function: reminders
// Envoie un email de rappel J-2h aux conducteurs et passagers acceptés
// pour les instances de trajet démarrant dans la fenêtre [now+1h45, now+2h15].
// Idempotent via la table `reminders_log`.

// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  renderConducteurEmail,
  renderPassagerEmail,
  sendResend,
} from "./_email.ts";

interface CulteRow {
  id: string;
  libelle: string;
  heure: string;
}

interface TrajetRow {
  id: string;
  conducteur_id: string;
  heure_depart: string | null;
  voiture_modele: string | null;
  voiture_couleur: string | null;
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
  nom: string;
  telephone: string;
  voiture_modele: string | null;
  voiture_couleur: string | null;
}

interface ReservationRow {
  id: string;
  passager_id: string;
  pickup_adresse: string;
  statut: string;
}

interface RunSummary {
  sent: number;
  skipped: number;
  errors: number;
}

const FROM_EMAIL = Deno.env.get("REMINDERS_FROM_EMAIL") ?? "Covoiturage <noreply@covoiturage.local>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Fuseau horaire de l'église, configurable. Défaut: Africa/Abidjan (GMT+0, sans DST).
// Pour la France: REMINDERS_TZ=Europe/Paris (gère DST automatiquement).
const REMINDERS_TZ = Deno.env.get("REMINDERS_TZ") ?? "Africa/Abidjan";

const pad = (n: number): string => n.toString().padStart(2, "0");

// Convertit une "wall time" (date YYYY-MM-DD + heure HH:MM) interprétée
// dans REMINDERS_TZ en timestamp UTC (ms). Gère DST proprement.
const toUtcMs = (date: string, heure: string): number => {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = heure.split(":").map(Number);
  const targetWallMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);

  // Première estimation : on traite la wall time comme si elle était UTC.
  let utcMs = targetWallMs;

  // On itère 2x pour converger même près d'une transition DST.
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
  // On élargit côté SQL : on récupère les instances dont la date couvre la fenêtre.
  // Marge de sécurité : on prend now et now+1 jour (le filtrage fin se fait en TS).
  const minMs = now.getTime();
  const maxMs = now.getTime() + 3 * 60 * 60 * 1000;
  const fmt = (ms: number): string => {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  return { dateMin: fmt(minMs - 24 * 3600 * 1000), dateMax: fmt(maxMs + 24 * 3600 * 1000) };
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
    // ignore unique-violation (idempotence) mais log les autres
    if (!String(error.message).toLowerCase().includes("duplicate")) {
      console.error("logSent error", error);
    }
  }
};

const processInstance = async (
  client: SupabaseClient,
  instance: InstanceRow,
  summary: RunSummary,
): Promise<void> => {
  const trajet = instance.trajet;
  if (!trajet || !trajet.heure_depart || !trajet.culte) return;

  // Conducteur profile
  const { data: conducteur, error: condErr } = await client
    .from("profiles")
    .select("id, prenom, nom, telephone, voiture_modele, voiture_couleur")
    .eq("id", trajet.conducteur_id)
    .single();
  if (condErr || !conducteur) {
    console.error("conducteur fetch error", condErr);
    summary.errors++;
    return;
  }
  const conducteurTyped = conducteur as ProfileRow;

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
      .select("id, prenom, nom, telephone, voiture_modele, voiture_couleur")
      .in("id", passagerIds);
    if (profErr) {
      console.error("passagers fetch error", profErr);
      summary.errors++;
      return;
    }
    for (const p of (profs ?? []) as ProfileRow[]) passagerProfiles.set(p.id, p);
  }

  const heureDepart = trajet.heure_depart.slice(0, 5);
  const programme = trajet.culte.libelle;
  const dateAffichage = instance.date;

  // ----- Email conducteur -----
  const conducteurKind = "reminder_2h_conducteur";
  try {
    const skip = await alreadySent(client, instance.id, conducteurTyped.id, conducteurKind);
    if (skip) {
      summary.skipped++;
    } else {
      const conducteurEmail = await fetchEmail(client, conducteurTyped.id);
      if (!conducteurEmail) {
        summary.errors++;
      } else {
        const passagersForEmail = reservations
          .map((r) => {
            const p = passagerProfiles.get(r.passager_id);
            if (!p) return null;
            return {
              prenom: p.prenom,
              nom: p.nom,
              pickupAdresse: r.pickup_adresse,
              telephone: p.telephone,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        const { subject, html } = renderConducteurEmail({
          prenom: conducteurTyped.prenom,
          programme,
          date: dateAffichage,
          heureDepart,
          passagers: passagersForEmail,
        });
        await sendResend(RESEND_API_KEY, FROM_EMAIL, conducteurEmail, subject, html);
        await logSent(client, instance.id, conducteurTyped.id, conducteurKind);
        summary.sent++;
      }
    }
  } catch (e) {
    console.error("conducteur send error", e);
    summary.errors++;
  }

  // ----- Emails passagers -----
  for (const r of reservations) {
    const passagerKind = "reminder_2h";
    try {
      const passager = passagerProfiles.get(r.passager_id);
      if (!passager) {
        summary.errors++;
        continue;
      }
      const skip = await alreadySent(client, instance.id, passager.id, passagerKind);
      if (skip) {
        summary.skipped++;
        continue;
      }
      const passagerEmail = await fetchEmail(client, passager.id);
      if (!passagerEmail) {
        summary.errors++;
        continue;
      }
      const { subject, html } = renderPassagerEmail({
        prenom: passager.prenom,
        conducteurPrenom: conducteurTyped.prenom,
        conducteurNom: conducteurTyped.nom,
        programme,
        date: dateAffichage,
        heureDepart,
        pickupAdresse: r.pickup_adresse,
        voitureModele: conducteurTyped.voiture_modele,
        voitureCouleur: conducteurTyped.voiture_couleur,
        conducteurTelephone: conducteurTyped.telephone,
      });
      await sendResend(RESEND_API_KEY, FROM_EMAIL, passagerEmail, subject, html);
      await logSent(client, instance.id, passager.id, passagerKind);
      summary.sent++;
    } catch (e) {
      console.error("passager send error", e);
      summary.errors++;
    }
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
  const lowerMs = now.getTime() + 105 * 60 * 1000; // +1h45
  const upperMs = now.getTime() + 135 * 60 * 1000; // +2h15

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
      JSON.stringify({ sent: summary.sent, skipped: summary.skipped, errors: summary.errors }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("reminders run failed", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
