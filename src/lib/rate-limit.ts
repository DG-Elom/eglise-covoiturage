/**
 * Rate limiter en mémoire (par instance serverless), à fenêtre fixe.
 *
 * Chaque appel à `createRateLimiter` crée un bucket indépendant : une route
 * = un limiteur. Le compteur est gardé par clé (typiquement le userId).
 *
 * Limite assumée : l'état vit dans la mémoire du process. Sur Vercel, plusieurs
 * instances peuvent coexister — c'est un garde-fou anti-abus/coût, pas une
 * limite stricte distribuée. Pour une limite forte, déléguer à l'infra (Vercel
 * rate limiting) ou à un store partagé (Upstash/Redis).
 */
export function createRateLimiter(opts: { max: number; windowMs: number }) {
  const map = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string, now: number = Date.now()): boolean {
    const entry = map.get(key);
    if (!entry || now >= entry.resetAt) {
      map.set(key, { count: 1, resetAt: now + opts.windowMs });
      return true;
    }
    if (entry.count >= opts.max) return false;
    entry.count++;
    return true;
  };
}
