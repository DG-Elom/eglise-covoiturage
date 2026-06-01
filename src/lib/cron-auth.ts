// Helper pur d'authentification des routes cron.
// Les crons Vercel envoient `Authorization: Bearer ${CRON_SECRET}`.
// La validation est faite AVANT tout traitement dans chaque route.

/**
 * Valide l'en-tête Authorization d'une requête cron contre le CRON_SECRET.
 *
 * Règles de sécurité :
 * - si `secret` est absent/vide (mal configuré), on REFUSE toujours
 *   (jamais d'accès ouvert par défaut) ;
 * - on exige le schéma `Bearer ` exact suivi du secret ;
 * - comparaison stricte (pas de trim laxiste sur le secret).
 *
 * @param authHeader valeur brute de l'en-tête `Authorization` (peut être null)
 * @param secret valeur de `process.env.CRON_SECRET`
 */
export function isValidCronAuth(
  authHeader: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}
