"use client";

import { useEffect, useState } from "react";
import {
  Sprout,
  TreeDeciduous,
  Trees,
  Car,
  Gem,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeBadges, type Badge, type UserStats } from "@/lib/badges";

const ICON_MAP: Record<string, LucideIcon> = {
  Sprout,
  TreeDeciduous,
  Trees,
  Car,
  Gem,
  Zap,
};

const COULEUR_CLASSES: Record<Badge["couleur"], string> = {
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  violet:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  slate:
    "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

function BadgePill({ badge }: { badge: Badge }) {
  const Icon = ICON_MAP[badge.icon] ?? Sprout;
  return (
    <span
      title={badge.description}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${COULEUR_CLASSES[badge.couleur]}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {badge.label}
    </span>
  );
}

function BadgesSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="inline-block h-6 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
        />
      ))}
    </div>
  );
}

export function UserBadges({ userId }: { userId: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setBadges(computeBadges(data as UserStats));
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <BadgesSkeleton />;
  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <BadgePill key={badge.id} badge={badge} />
      ))}
    </div>
  );
}
