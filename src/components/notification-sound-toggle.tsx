"use client";

import { useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { Toggle } from "@/components/toggle";
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
        <Toggle checked={enabled} onChange={toggle} aria-label="Sons de notification" />
      </div>
    </div>
  );
}
