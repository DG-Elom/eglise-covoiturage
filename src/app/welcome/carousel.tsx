"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Users, Plus, Search, MessageCircle } from "lucide-react";

type Role = "conducteur" | "passager" | "les_deux";

type Screen = {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
};

function buildScreens(prenom: string, role: Role): Screen[] {
  const screen2: Screen =
    role === "passager"
      ? {
          icon: <Search className="size-16 text-emerald-600" />,
          title: "Trouve un trajet",
          subtitle:
            "Saisis ton adresse, on te montre les conducteurs qui passent près de chez toi.",
        }
      : {
          icon: <Plus className="size-16 text-emerald-600" />,
          title: "Propose un trajet",
          subtitle:
            "Déclare ton itinéraire et les fidèles proches pourront te rejoindre.",
        };

  return [
    {
      icon: <Users className="size-16 text-emerald-600" />,
      title: (
        <>
          Bienvenue, {prenom}&nbsp;👋
        </>
      ),
      subtitle:
        "Covoiturage ICC Metz, c'est l'app pour aller au culte ensemble. Gratuit, simple, communautaire.",
    },
    screen2,
    {
      icon: <MessageCircle className="size-16 text-emerald-600" />,
      title: "Discute en direct",
      subtitle:
        "Une fois la résa acceptée, vous pouvez vous écrire dans l'app pour vous coordonner.",
    },
  ];
}

function markWelcomed(router: ReturnType<typeof useRouter>) {
  localStorage.setItem("welcomed", "1");
  router.push("/dashboard");
}

export function OnboardingCarousel({
  prenom,
  role,
}: {
  prenom: string;
  role: Role;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const screens = buildScreens(prenom, role);
  const isLast = current === screens.length - 1;

  function goNext() {
    if (isLast) {
      markWelcomed(router);
    } else {
      setCurrent((c) => c + 1);
    }
  }

  const screen = screens[current];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-slate-950">
      <button
        type="button"
        onClick={() => markWelcomed(router)}
        className="absolute right-5 top-5 text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300"
      >
        Passer
      </button>

      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex size-32 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/40 dark:to-emerald-800/40">
          {screen.icon}
        </div>

        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {screen.title}
          </h1>
          <p className="text-base leading-relaxed text-slate-500 dark:text-slate-400">
            {screen.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {screens.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Écran ${i + 1}`}
              className={`rounded-full bg-emerald-600 transition-all duration-200 ${
                i === current
                  ? "size-3 opacity-100"
                  : "size-2 opacity-30 hover:opacity-60"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          className="w-full rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
        >
          {isLast ? "C'est parti !" : "Suivant"}
        </button>
      </div>
    </div>
  );
}
