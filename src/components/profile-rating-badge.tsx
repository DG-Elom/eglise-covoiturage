type Props = { avg: number | null; count: number; size?: "sm" | "md" };

export function ProfileRatingBadge({ avg, count, size = "md" }: Props) {
  if (count === 0) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500">
        Pas encore noté
      </span>
    );
  }

  const displayAvg = avg !== null ? avg.toFixed(1) : "—";
  const textSize = size === "sm" ? "text-[11px]" : "text-xs";

  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${textSize} text-amber-600 dark:text-amber-400`}>
      ⭐ {displayAvg}
      <span className="font-normal text-slate-500 dark:text-slate-400">
        ({count})
      </span>
    </span>
  );
}
