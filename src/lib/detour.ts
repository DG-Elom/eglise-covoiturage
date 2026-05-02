const MINUTES_PAR_KM_URBAIN = 2.4; // 25 km/h moyenne urbaine Metz

export function kmToMinutes(km: number): number {
  if (!Number.isFinite(km) || km <= 0) return 0;
  return Math.round(km * MINUTES_PAR_KM_URBAIN);
}

export function formatDetour(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "0 km";
  const minutes = kmToMinutes(km);
  const kmStr = km.toFixed(1).replace(/\.0$/, "");
  if (minutes === 0) return `${kmStr} km · moins d'1 min`;
  return `${kmStr} km · ~${minutes} min`;
}

export function formatDetourLong(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "Aucun détour";
  const minutes = kmToMinutes(km);
  const kmStr = km.toFixed(1).replace(/\.0$/, "");
  if (minutes === 0) return `${kmStr} km de détour`;
  return `${kmStr} km de détour (~${minutes} min)`;
}
