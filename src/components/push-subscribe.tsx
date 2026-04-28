"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

const LS_KEY = "push-subscribed-endpoint";

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = typeof window !== "undefined" ? window.atob(base64) : "";
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export function PushSubscribe() {
  const [supported, setSupported] = useState(false);
  const [subscribedEndpoint, setSubscribedEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;

    const stored = window.localStorage.getItem(LS_KEY);
    if (stored) setSubscribedEndpoint(stored);

    // Vérifier l'état réel auprès du SW
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setSubscribedEndpoint(sub.endpoint);
          window.localStorage.setItem(LS_KEY, sub.endpoint);
        } else if (stored) {
          window.localStorage.removeItem(LS_KEY);
          setSubscribedEndpoint(null);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublic) {
        toast.error("Notifications désactivées (config manquante)");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permission refusée");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(vapidPublic),
        });
      }

      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "push_disabled") {
          toast.error("Push désactivé côté serveur");
        } else {
          toast.error("Échec de l'activation");
        }
        return;
      }

      window.localStorage.setItem(LS_KEY, sub.endpoint);
      setSubscribedEndpoint(sub.endpoint);
      toast.success("Notifications activées");
    } catch (err) {
      console.warn("[push] enable failed", err);
      toast.error("Erreur lors de l'activation");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint ?? subscribedEndpoint;
      if (sub) await sub.unsubscribe();
      if (endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      window.localStorage.removeItem(LS_KEY);
      setSubscribedEndpoint(null);
      toast.success("Notifications désactivées");
    } catch (err) {
      console.warn("[push] disable failed", err);
      toast.error("Erreur lors de la désactivation");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  const isOn = subscribedEndpoint !== null;
  const Icon = isOn ? BellOff : Bell;

  return (
    <button
      type="button"
      onClick={isOn ? disable : enable}
      disabled={busy}
      title={isOn ? "Désactiver les notifications" : "Activer les notifications"}
      aria-label={isOn ? "Désactiver les notifications" : "Activer les notifications"}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icon className="size-3.5" />
      <span className="sr-only sm:not-sr-only">{isOn ? "Désactiver" : "Activer les notifications"}</span>
    </button>
  );
}
