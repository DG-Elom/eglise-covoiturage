"use client";

import Link from "next/link";
import { tap } from "@/lib/haptics";

export function ActionCard({
  href,
  icon,
  title,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  tone: "emerald" | "slate";
}) {
  const styles =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 hover:border-emerald-400 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-600"
      : "border-slate-200 bg-white hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500";
  return (
    <Link
      href={href}
      onClick={() => tap()}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition active:scale-95 transition-transform ${styles}`}
    >
      <div className="inline-flex size-9 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-slate-800">
        {icon}
      </div>
      <span className="font-medium">{title}</span>
    </Link>
  );
}
