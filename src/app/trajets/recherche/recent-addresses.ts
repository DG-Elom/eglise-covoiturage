export function deduplicateRecentAddresses(
  rows: { pickup_adresse: string }[],
  limit = 5,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of rows) {
    const addr = row.pickup_adresse;
    if (!addr || seen.has(addr)) continue;
    seen.add(addr);
    result.push(addr);
    if (result.length >= limit) break;
  }
  return result;
}
