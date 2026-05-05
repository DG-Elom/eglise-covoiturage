import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type SmsKind = "reminder_2h" | "decision" | "admin_broadcast";

export type SmsResult =
  | { ok: true; messageId?: string }
  | { skipped: true; reason: "no_api_key" | "no_phone" | "invalid_phone" | "opted_out" | "already_sent" }
  | { error: string };

const BREVO_ENDPOINT = "https://api.brevo.com/v3/transactionalSMS/sms";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Normalise un numéro français vers E.164 (+33XXXXXXXXX).
// Retourne null si format invalide.
export function normalizeFrPhone(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  if (/^\+33[1-9]\d{8}$/.test(cleaned)) return cleaned;
  if (/^0033[1-9]\d{8}$/.test(cleaned)) return "+" + cleaned.slice(2);
  if (/^0[1-9]\d{8}$/.test(cleaned)) return "+33" + cleaned.slice(1);
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) return cleaned; // autre pays E.164 valide
  return null;
}

// Brevo limite : 11 caractères alphanumériques (pas d'espaces, pas d'accents).
const SMS_SENDER = (process.env.BREVO_SMS_SENDER ?? "ICCcovoit").slice(0, 11);

async function callBrevo(
  apiKey: string,
  recipient: string,
  content: string,
): Promise<{ ok: true; messageId?: string } | { error: string }> {
  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: SMS_SENDER,
        recipient,
        content,
        type: "transactional",
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `brevo_${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { messageId?: string | number };
    return { ok: true, messageId: data.messageId !== undefined ? String(data.messageId) : undefined };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export type SendSmsArgs = {
  userId: string;
  kind: SmsKind;
  body: string;
  // Clé fonctionnelle d'idempotence (ex: `reminder_2h:<instance_id>:<userId>`).
  // Si fournie, le SMS n'est envoyé qu'une seule fois pour cette clé.
  dedupKey: string;
};

// Envoie un SMS à un utilisateur en respectant ses préférences.
// Fire-and-forget côté caller : les erreurs sont loggées, jamais propagées.
export async function sendSmsTo({ userId, kind, body, dedupKey }: SendSmsArgs): Promise<SmsResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[sms] BREVO_API_KEY manquant, SMS ignoré:", kind);
    return { skipped: true, reason: "no_api_key" };
  }

  const admin = serviceClient();
  if (!admin) return { error: "no_service_client" };

  // Récupère téléphone + préférence SMS
  const { data: profile } = await admin
    .from("profiles")
    .select("telephone")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.telephone) return { skipped: true, reason: "no_phone" };

  const phone = normalizeFrPhone(profile.telephone);
  if (!phone) {
    console.warn("[sms] téléphone invalide pour user", userId, "→", profile.telephone);
    return { skipped: true, reason: "invalid_phone" };
  }

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("sms_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  // sms_enabled est défaut true ; si pas de ligne ou colonne null, on envoie.
  if (prefs && prefs.sms_enabled === false) {
    return { skipped: true, reason: "opted_out" };
  }

  // Idempotence : si dedup_key existe déjà, on n'envoie pas.
  const { data: existing } = await admin
    .from("sms_log")
    .select("id")
    .eq("dedup_key", dedupKey)
    .maybeSingle();
  if (existing) return { skipped: true, reason: "already_sent" };

  const result = await callBrevo(apiKey, phone, body);

  if ("error" in result) {
    // On ne persiste pas les échecs : sinon le dedup_key UNIQUE bloquerait
    // tout retry une fois Brevo rétabli. La cron `reminders` repassera et
    // la prochaine tentative pourra aboutir.
    console.error("[sms] échec envoi", kind, dedupKey, result.error);
    return result;
  }

  await admin.from("sms_log").insert({
    user_id: userId,
    kind,
    phone,
    dedup_key: dedupKey,
    provider: "brevo",
    provider_message_id: result.messageId,
    status: "sent",
  } as never);

  return { ok: true, messageId: result.messageId };
}
