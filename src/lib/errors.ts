/**
 * Traduit une erreur (Postgres/Supabase/fetch/inconnue) en message lisible
 * pour un utilisateur final. Objectif : ne JAMAIS afficher de jargon technique
 * ("duplicate key value violates unique constraint…", "RLS", code Postgres) a
 * un utilisateur. Pour les pages admin, on peut garder le message brut.
 *
 * Usage typique cote client :
 *   toast.error(humanizeApiError(body.error));
 *   toast.error(humanizeApiError(error));
 */

type ErrorLike =
  | string
  | { message?: string; code?: string; error?: string }
  | null
  | undefined;

const FALLBACK = "Une erreur est survenue. Réessaie dans un instant.";

// Codes/marqueurs structures renvoyes par nos routes API
const API_ERROR_MAP: Record<string, string> = {
  unauthorized: "Tu dois te reconnecter pour continuer.",
  forbidden: "Tu n'as pas les droits pour faire cette action.",
  invalid_body: "Une information est manquante ou invalide.",
  bad_request: "Une information est manquante ou invalide.",
  insert_failed: "L'enregistrement n'a pas pu être créé. Réessaie.",
  update_failed: "La mise à jour n'a pas pu être enregistrée. Réessaie.",
  not_found: "Élément introuvable. Il a peut-être été supprimé.",
  instance_full: "Ce trajet est complet.",
  already_requested: "Tu as déjà une demande pour ce trajet.",
  rate_limited: "Trop de demandes. Patiente un peu avant de réessayer.",
};

// Patterns sur le message brut (Postgres, Supabase, fetch)
const PATTERN_MAP: Array<{ test: RegExp; message: string }> = [
  // Postgres : violation de contrainte UNIQUE sur reservations
  {
    test: /duplicate key.*reservations_passager_id.*sens_key/i,
    message: "Tu as déjà une demande pour ce trajet.",
  },
  // Postgres : violation UNIQUE generique
  {
    test: /duplicate key value violates unique constraint/i,
    message: "Cet élément existe déjà.",
  },
  // Postgres : foreign key
  {
    test: /violates foreign key constraint/i,
    message: "Référence introuvable. Recharge la page et réessaie.",
  },
  // Postgres : NOT NULL
  {
    test: /null value in column .* violates not-null/i,
    message: "Une information obligatoire est manquante.",
  },
  // Postgres : check constraint
  {
    test: /violates check constraint/i,
    message: "Une valeur ne respecte pas les règles attendues.",
  },
  // Supabase / Postgres : RLS
  {
    test: /(permission denied|row[- ]level security|RLS|42501)/i,
    message: "Tu n'as pas les droits pour cette action.",
  },
  // Auth / JWT
  {
    test: /(JWT|jwt expired|invalid token|not authenticated|auth session)/i,
    message: "Ta session a expiré. Reconnecte-toi.",
  },
  // Reseau
  {
    test: /(failed to fetch|network error|networkerror|ECONNREFUSED|ETIMEDOUT)/i,
    message: "Problème de connexion. Vérifie ton réseau et réessaie.",
  },
  // Trigger metier instance_full (au cas ou il remonte en texte brut)
  {
    test: /instance_full/i,
    message: "Ce trajet est complet.",
  },
];

function extractRawMessage(err: ErrorLike): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  return err.message ?? err.error ?? "";
}

export function humanizeApiError(err: ErrorLike): string {
  const raw = extractRawMessage(err).trim();
  if (!raw) return FALLBACK;

  // 1. Match exact sur un code API connu
  if (API_ERROR_MAP[raw]) return API_ERROR_MAP[raw];

  // 2. Match sur un pattern Postgres/Supabase/fetch
  for (const { test, message } of PATTERN_MAP) {
    if (test.test(raw)) return message;
  }

  // 3. Si le message ressemble a une phrase francaise courte deja lisible,
  //    on l'affiche tel quel. Heuristique : pas de mot-cle technique evident
  //    et longueur raisonnable.
  const looksTechnical =
    /(duplicate key|constraint|relation|column|schema|syntax error|null value|PGRST|ECONN|undefined|TypeError)/i.test(
      raw,
    );
  if (!looksTechnical && raw.length <= 140) {
    return raw;
  }

  // 4. Fallback generique
  return FALLBACK;
}
