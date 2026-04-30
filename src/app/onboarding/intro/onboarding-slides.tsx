"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, MapPin, Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

const LS_ONBOARDING_KEY = "onboarding-seen";
const LS_PUSH_KEY = "push-subscribed-endpoint";

type Slide = {
  icon: React.ReactNode;
  titre: string;
  texte: string;
  cta?: React.ReactNode;
};

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

function NotifCta() {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function activerNotifs() {
    if (typeof window === "undefined") return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permission refusée — tu pourras l'activer plus tard dans les réglages.");
        setDone(true);
        return;
      }

      const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublic) {
        toast.error("Notifications désactivées (config manquante).");
        setDone(true);
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
        toast.error("Échec de l'activation — réessaie plus tard.");
        setDone(true);
        return;
      }

      if (json.endpoint) window.localStorage.setItem(LS_PUSH_KEY, json.endpoint);
      toast.success("Notifications activées !");
      setDone(true);
    } catch (err) {
      console.warn("[onboarding] push activation failed", err);
      toast.error("Erreur lors de l'activation.");
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <Bell className="size-4" />
        Activé
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={activerNotifs}
      disabled={busy}
      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
    >
      <Bell className="size-4" />
      {busy ? "Activation…" : "Activer"}
    </button>
  );
}

function buildSlides(): Slide[] {
  return [
    {
      icon: <Users className="size-16 text-emerald-600" />,
      titre: "Bienvenue dans la famille covoit ICC",
      texte:
        "Ensemble, on rend chaque culte accessible. Plus de raisons de manquer un dimanche.",
    },
    {
      icon: <MapPin className="size-16 text-emerald-600" />,
      titre: "Trouve ou propose un trajet en 2 clics",
      texte:
        "Renseigne ton point de départ, choisis le culte, c'est parti.",
    },
    {
      icon: <Bell className="size-16 text-emerald-600" />,
      titre: "Active les notifications",
      texte:
        "Reçois un rappel 2h avant ton trajet et un son discret quand quelqu'un te répond.",
      cta: <NotifCta />,
    },
  ];
}

export function OnboardingSlides() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const slides = buildSlides();
  const isLast = current === slides.length - 1;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const alreadySeen = window.localStorage.getItem(LS_ONBOARDING_KEY);
      if (alreadySeen === "1") {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  function terminer() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LS_ONBOARDING_KEY, "1");
    }
    router.push("/dashboard");
  }

  function passer() {
    terminer();
  }

  const slide = slides[current];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-slate-950">
      <button
        type="button"
        onClick={passer}
        className="absolute right-5 top-5 text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 rounded"
      >
        Passer
      </button>

      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40">
          {slide.icon}
        </div>

        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {slide.titre}
          </h1>
          <p className="text-base leading-relaxed text-slate-500 dark:text-slate-400">
            {slide.texte}
          </p>
          {slide.cta && (
            <div className="flex justify-center pt-1">{slide.cta}</div>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Progression de l'introduction"
          className="flex items-center gap-2"
        >
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Diapositive ${i + 1} sur ${slides.length}`}
              onClick={() => setCurrent(i)}
              className={`rounded-full bg-emerald-600 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                i === current
                  ? "size-3 opacity-100"
                  : "size-2 opacity-30 hover:opacity-60"
              }`}
            />
          ))}
        </div>

        <div className="flex w-full items-center gap-3">
          {current > 0 && (
            <button
              type="button"
              onClick={() => setCurrent((c) => c - 1)}
              aria-label="Diapositive précédente"
              className="flex items-center justify-center rounded-xl border border-slate-200 p-3 text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}

          {isLast ? (
            <button
              type="button"
              onClick={terminer}
              className="flex-1 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              C&apos;est parti !
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrent((c) => c + 1)}
              aria-label="Diapositive suivante"
              className="ml-auto flex items-center justify-center rounded-xl bg-emerald-600 p-3 text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
