export type ImproveTextContext = "bio" | "annulation" | "thanks" | "message";

const VALID_CONTEXTS: ImproveTextContext[] = ["bio", "annulation", "thanks", "message"];

type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateImproveTextInput(input: {
  text: unknown;
  context: unknown;
}): ValidationResult {
  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    return { ok: false, error: "text est requis et ne peut pas être vide" };
  }
  if (input.text.length > 500) {
    return { ok: false, error: "text ne peut pas dépasser 500 caractères" };
  }
  if (!VALID_CONTEXTS.includes(input.context as ImproveTextContext)) {
    return { ok: false, error: `context doit être l'un de : ${VALID_CONTEXTS.join(", ")}` };
  }
  return { ok: true };
}

const CONTEXT_HINTS: Record<ImproveTextContext, string> = {
  bio: "Il s'agit d'une bio de profil. Garde un ton chaleureux, personnel et sincère.",
  annulation: "Il s'agit d'un motif d'annulation. Sois poli, bref et empathique.",
  thanks: "Il s'agit d'un message de remerciement. Exprime gratitude et chaleur chrétienne.",
  message: "Il s'agit d'un message à envoyer à un autre membre. Garde un ton cordial et clair.",
};

export function buildImproveTextPrompt(text: string, context: ImproveTextContext): string {
  return `${CONTEXT_HINTS[context]}\n\nTexte à reformuler :\n${text}`;
}
