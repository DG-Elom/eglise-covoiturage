export function computeAcceptanceRate(
  accepted: number,
  refused: number,
): number | null {
  const total = accepted + refused;
  if (total === 0) return null;
  return accepted / total;
}
