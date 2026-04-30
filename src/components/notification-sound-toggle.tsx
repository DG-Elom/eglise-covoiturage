"use client";

import { useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { isSoundEnabled, playNotifSound, setSoundEnabled, STORAGE_KEY } from "@/lib/notification-sound";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};
const getSnapshot = () => (isSoundEnabled() ? "1" : "0");
const getServerSnapshot = () => "1";

export function NotificationSoundToggle() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const enabled = snapshot === "1";

  function toggle() {
    const next = !enabled;
    setSoundEnabled(next);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    if (next) void playNotifSound("notif");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {enabled ? (
            <Bell className="size-5 text-emerald-600 mt-0.5" />
          ) : (
            <BellOff className="size-5 text-slate-400 mt-0.5" />
          )}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sons de notification
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Joue un son court à chaque demande de réservation, réponse, message ou rappel.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
