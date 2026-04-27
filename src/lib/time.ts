export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor((total / 60) % 24);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function fenetreDepart(heureDepart: string, minutes = 30): string {
  const start = heureDepart.slice(0, 5);
  const end = addMinutes(heureDepart, minutes);
  return `${start} – ${end}`;
}
