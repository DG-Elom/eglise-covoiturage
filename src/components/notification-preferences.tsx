"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NotifKind, NotifPrefs } from "@/lib/notification-preferences";

type AllPrefs = NotifPrefs;

type KindConfig = {
  kind: keyof AllPrefs;
  label: string;
  description?: string;
  adminOnly?: boolean;
};

const KINDS: KindConfig[] = [
  { kind: "reminder_2h", label: "Rappel 2h avant le trajet" },
  { kind: "imminent_departure", label: "Rappel 15 min avant le départ" },
  { kind: "new_request", label: "Nouvelle demande de réservation" },
  { kind: "decision", label: "Réponse à ma demande (acceptée/refusée)" },
  { kind: "trajet_cancelled", label: "Trajet annulé par le conducteur" },
  { kind: "new_message", label: "Nouveau message de chat" },
  { kind: "thanks_received", label: "Mot de remerciement reçu" },
  { kind: "weekly_summary_admin", label: "Résumé hebdomadaire (admin)", adminOnly: true },
  {
    kind: "engagement_relance",
    label: "Relances pour t'aider à démarrer (3 max)",
    description:
      "On t'envoie 3 messages doux dans les 2 premières semaines pour t'aider à trouver ton premier trajet, puis on arrête.",
  },
];

const DEFAULT_PREFS: AllPrefs = {
  reminder_2h: true,
  imminent_departure: true,
  new_request: true,
  decision: true,
  trajet_cancelled: true,
  new_message: true,
  thanks_received: true,
  weekly_summary_admin: true,
  engagement_relance: true,
};

type Props = {
  userId: string;
  isAdmin: boolean;
};

export function NotificationPreferences({ userId, isAdmin }: Props) {
  const [prefs, setPrefs] = useState<AllPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof AllPrefs | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            reminder_2h: data.reminder_2h,
            imminent_departure: data.imminent_departure,
            new_request: data.new_request,
            decision: data.decision,
            trajet_cancelled: data.trajet_cancelled,
            new_message: data.new_message,
            thanks_received: data.thanks_received,
            weekly_summary_admin: data.weekly_summary_admin,
            engagement_relance: data.engagement_relance ?? true,
          });
        }
        setLoading(false);
      });
  }, [userId]);

  async function toggle(kind: keyof AllPrefs) {
    const next = !prefs[kind];
    setPrefs((prev) => ({ ...prev, [kind]: next }));
    setSaving(kind);

    const supabase = createClient();
    const row = { user_id: userId, [kind]: next } as unknown as {
      user_id: string;
    } & Record<keyof AllPrefs, boolean>;
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(row, { onConflict: "user_id" });

    setSaving(null);

    if (error) {
      setPrefs((prev) => ({ ...prev, [kind]: !next }));
      toast.error("Erreur lors de la sauvegarde");
    } else {
      toast.success(next ? "Activé" : "Désactivé", { duration: 1500 });
    }
  }

  const visibleKinds = KINDS.filter((k) => !k.adminOnly || isAdmin);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Notifications push
      </h2>

      {loading ? (
        <div className="space-y-3">
          {visibleKinds.map((k) => (
            <div key={k.kind} className="h-6 rounded bg-slate-100 animate-pulse dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleKinds.map(({ kind, label, description }) => {
            const enabled = prefs[kind];
            const isSaving = saving === kind;
            return (
              <li key={kind} className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                  {description && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs">
                      {description}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  disabled={isSaving}
                  onClick={() => void toggle(kind)}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                    enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
