// Logique pure du parrainage (acquisition).
// Génération du lien d'invitation, du message WhatsApp et du statut Ambassadeur.
// Aucune dépendance Supabase/réseau ici : 100 % testable.

export const REFERRAL_BASE_URL = "https://app.icc-covoit.fr";

/** Caractères du code de parrainage : sans ambiguïté visuelle (pas de O/0/I/1/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

/**
 * Génère un code de parrainage lisible et sans ambiguïté.
 * `rng` est injectable pour tester de façon déterministe (par défaut Math.random).
 */
export function generateReferralCode(rng: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.floor(rng() * CODE_ALPHABET.length) % CODE_ALPHABET.length;
    code += CODE_ALPHABET[idx];
  }
  return code;
}

/** Vrai si la chaîne respecte le format d'un code de parrainage. */
export function isValidReferralCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false;
  for (const ch of code) {
    if (!CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Construit le lien d'invitation public à partir d'un code. */
export function buildReferralLink(
  code: string,
  baseUrl: string = REFERRAL_BASE_URL,
): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Message d'invitation (texte brut, prêt à partager).
 * `prenom` est le prénom du parrain (optionnel) pour personnaliser.
 */
export function buildReferralMessage(link: string, prenom?: string): string {
  const intro = prenom?.trim()
    ? `${prenom.trim()} t'invite à rejoindre`
    : "Rejoins-nous sur";
  return (
    `${intro} ICC Covoiturage 🚗 — l'appli de covoiturage de l'église ` +
    `pour aller au culte ensemble. Inscris-toi avec mon lien : ${link}`
  );
}

/** Lien wa.me pré-rempli (WhatsApp en 1 tap). */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Statut Ambassadeur dès qu'au moins un parrainage a abouti (status = 'joined'). */
export function isAmbassadeur(parrainagesReussis: number): boolean {
  return parrainagesReussis >= 1;
}

/** Extrait un code `?ref=` d'une URL d'arrivée (onboarding). Renvoie null si absent/invalide. */
export function extractReferralCodeFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const ref = url.searchParams.get("ref");
    if (ref && isValidReferralCode(ref)) return ref;
    return null;
  } catch {
    return null;
  }
}
