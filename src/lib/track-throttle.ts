/**
 * Determines whether a position upsert should be performed based on throttle policy.
 * Returns true if lastTs is null (first call) or if enough time has elapsed since lastTs.
 */
export function shouldUpsert(
  lastTs: number | null,
  now: number,
  throttleMs: number,
): boolean {
  if (lastTs === null) return true;
  return now - lastTs >= throttleMs;
}
