"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { TopConducteur, TopConducteursResponse } from "@/app/api/top-conducteurs/route";

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function TopConducteursSkeleton() {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
      <div className="mb-3 h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="size-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ConducteurCard({
  conducteur,
  rank,
}: {
  conducteur: TopConducteur;
  rank: number;
}) {
  const medal = MEDALS[rank] ?? "";
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-lg leading-none" aria-label={`${rank + 1}e place`}>
        {medal}
      </span>
      <Avatar
        photoUrl={conducteur.photoUrl}
        prenom={conducteur.prenom}
        nom={conducteur.nom}
        size="sm"
        className="ring-2 ring-emerald-300 dark:ring-emerald-700"
      />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">
          {conducteur.prenom}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {conducteur.trajetsCeMois} trajet{conducteur.trajetsCeMois > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

export function TopConducteurs() {
  const [top, setTop] = useState<TopConducteur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/top-conducteurs")
      .then((r) => r.json() as Promise<TopConducteursResponse>)
      .then((data) => {
        if (cancelled) return;
        setTop(data.top ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <TopConducteursSkeleton />;
  if (top.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/20">
      <h2 className="mb-3 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
        Covoitureurs du mois
      </h2>
      <div className="flex gap-6">
        {top.map((conducteur, i) => (
          <ConducteurCard key={conducteur.id} conducteur={conducteur} rank={i} />
        ))}
      </div>
    </div>
  );
}
