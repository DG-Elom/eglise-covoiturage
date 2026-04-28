"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function OnlineToggle({
  initialAvailable,
  initialUntil,
}: {
  initialAvailable: boolean;
  initialUntil: string | null;
}) {
  const router = useRouter();
  const [available, setAvailable] = useState(initialAvailable);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);

  const stillValid =
    available && initialUntil && new Date(initialUntil) > new Date();
  const showAvailable = available && (!initialUntil || stillValid);

  async function toggle() {
    setBusy(true);
    const next = !showAvailable;
    const supabase = createClient();
    let until: string | null = null;
    if (next) {
      // Available until end of next Sunday at 23:59
      const now = new Date();
      const day = now.getDay(); // 0 = sunday
      const daysUntilSunday = day === 0 ? 7 : 7 - day;
      const sunday = new Date(now);
      sunday.setDate(now.getDate() + daysUntilSunday);
      sunday.setHours(23, 59, 59, 0);
      until = sunday.toISOString();
    }
    const { error } = await supabase.auth.getUser();
    if (error) {
      toast.error("Erreur");
      setBusy(false);
      return;
    }
    const userResp = await supabase.auth.getUser();
    const uid = userResp.data.user?.id;
    if (!uid) {
      toast.error("Session expirée");
      setBusy(false);
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ available_now: next, available_until: until } as never)
      .eq("id", uid);
    setBusy(false);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    setAvailable(next);
    toast.success(
      next ? "Tu es marqué comme disponible 🟢" : "Disponibilité retirée",
    );
    start(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || pending}
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] ${
        showAvailable
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
      }`}
    >
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span
            className={`inline-block size-2 rounded-full ${
              showAvailable
                ? "bg-emerald-500 animate-pulse"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
          {showAvailable ? "Disponible cette semaine" : "Pas disponible"}
        </p>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {showAvailable
            ? "Les passagers verront que tu peux conduire dimanche"
            : "Active si tu peux dépanner cette semaine"}
        </p>
      </div>
      {(busy || pending) && <Loader2 className="size-4 shrink-0 animate-spin" />}
    </button>
  );
}
