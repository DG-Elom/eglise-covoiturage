export function nextOccurrences(jourSemaine: number, count = 4): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: Date[] = [];
  let cursor = new Date(today);
  while (out.length < count) {
    if (cursor.getDay() === jourSemaine && cursor >= today) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
