import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { generateReferralCode } from "@/lib/referral";

// Helpers serveur du parrainage : génération/garantie d'un code et rattachement
// d'un nouvel inscrit à son parrain. Écritures via service-role (RLS bloque
// l'INSERT côté utilisateur sur referrals — cf migration v42).

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Garantit qu'un profil possède un referral_code, le génère et le persiste sinon.
 * Idempotent : renvoie le code existant s'il y en a déjà un.
 * Requiert un client (anon ou service-role) déjà authentifié pour `userId`.
 */
export async function ensureReferralCode(
  // Typage souple : on accepte n'importe quel client Supabase déjà câblé.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .maybeSingle();

  const existing = (profile as { referral_code?: string | null } | null)
    ?.referral_code;
  if (existing) return existing;

  // Tente jusqu'à 5 fois en cas de collision sur l'index unique.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await supabase
      .from("profiles")
      .update({ referral_code: code } as never)
      .eq("id", userId)
      .is("referral_code", null);
    if (!error) return code;
  }
  return null;
}

export type AttachResult =
  | { ok: true; created: boolean }
  | { skipped: true; reason: "no_service_role" | "self_referral" | "code_unknown" | "already_attached" }
  | { error: string };

/**
 * Rattache un nouvel inscrit (`invitedUserId`) au parrain identifié par `code`.
 * À appeler côté serveur depuis l'onboarding (cf followup : câbler l'onboarding).
 *
 * TODO (followup) : l'onboarding (src/app/onboarding/*) ne capture pas encore le
 * `?ref=` de l'URL d'arrivée. Pour câbler proprement : stocker le code dans un
 * cookie/localStorage à l'atterrissage sur `/?ref=<code>`, puis POST ce code
 * après création du profil et appeler `attachReferral` ici.
 */
export async function attachReferral(
  code: string,
  invitedUserId: string,
): Promise<AttachResult> {
  const svc = serviceClient();
  if (!svc) return { skipped: true, reason: "no_service_role" };
  // Types Supabase non régénérés (table referrals + colonne referral_code) :
  // cast local le temps du followup « régénérer les types ».
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = svc as any;

  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  const referrerId = (referrer as { id?: string } | null)?.id;
  if (!referrerId) return { skipped: true, reason: "code_unknown" };
  if (referrerId === invitedUserId) return { skipped: true, reason: "self_referral" };

  // Anti double-rattachement (l'index unique le garantit aussi en base).
  const { data: existing } = await admin
    .from("referrals")
    .select("id")
    .eq("invited_user_id", invitedUserId)
    .maybeSingle();
  if (existing) return { skipped: true, reason: "already_attached" };

  const { error } = await admin.from("referrals").insert({
    referrer_id: referrerId,
    invited_user_id: invitedUserId,
    status: "joined",
  } as never);

  if (error) return { error: error.message };
  return { ok: true, created: true };
}

/** Compte les parrainages aboutis (status = 'joined') pour le badge Ambassadeur. */
export async function countReferralsJoined(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  referrerId: string,
): Promise<number> {
  const { count } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", referrerId)
    .eq("status", "joined");
  return count ?? 0;
}
