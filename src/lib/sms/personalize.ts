// Jeton de personnalisation inséré par l'admin dans le corps du SMS.
// Accepte {prénom} et {prenom}, insensible à la casse.
const PRENOM_TOKEN = /\{pr[ée]nom\}/gi;

/** Vrai si le message contient au moins un jeton {prénom}. */
export function hasPrenomToken(message: string): boolean {
  // PRENOM_TOKEN a le flag `g` et est partagé au niveau module : RegExp.test()
  // mémorise lastIndex entre appels, donc on le remet à zéro avant de tester.
  // (personalize() utilise String.replace, qui réinitialise lastIndex seul.)
  PRENOM_TOKEN.lastIndex = 0;
  return PRENOM_TOKEN.test(message);
}

/**
 * Remplace chaque jeton {prénom} par le prénom du destinataire. Si le prénom
 * est vide, le jeton est retiré proprement (sans laisser de double espace).
 */
export function personalize(message: string, prenom: string): string {
  const value = prenom.trim();
  if (!value) {
    // Retire « {prénom} » et l'espace résiduel éventuel autour.
    return message.replace(new RegExp(`\\s*${PRENOM_TOKEN.source}`, "gi"), "").trimStart();
  }
  // Replacer en fonction : neutralise les motifs spéciaux ($&, $1, …) au cas où
  // un prénom contiendrait un « $ ».
  return message.replace(PRENOM_TOKEN, () => value);
}
