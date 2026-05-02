export function computeAcceptanceRate(
  accepted: number,
  refused: number,
): number | null {
  const total = accepted + refused;
  if (total === 0) return null;
  return accepted / total;
}

export function parseDetourRpcResult(data: unknown): number | null {
  if (data === null || data === undefined) return null;
  const n = Number(data);
  if (!Number.isFinite(n)) return null;
  return n;
}
