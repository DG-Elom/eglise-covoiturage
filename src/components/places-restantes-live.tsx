"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type PlacesColor = "emerald" | "amber" | "red";

export function getPlacesColor(restantes: number): PlacesColor {
  if (restantes === 0) return "red";
  if (restantes === 1) return "amber";
  return "emerald";
}

export function getPlacesLabel(restantes: number, total: number): string {
  if (restantes === 0) return "Complet";
  return `${restantes}/${total} place${restantes > 1 ? "s" : ""}`;
}

type Props = {
  trajetInstanceId: string;
  placesTotal: number;
  initialPlacesRestantes?: number;
};

const colorMap: Record<PlacesColor, string> = {
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

export function PlacesRestantesLive({
  trajetInstanceId,
  placesTotal,
  initialPlacesRestantes,
}: Props) {
  const [restantes, setRestantes] = useState<number>(
    initialPlacesRestantes ?? placesTotal,
  );
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(restantes);

  useEffect(() => {
    let cancelled = false;

    async function fetchInitial() {
      if (initialPlacesRestantes !== undefined) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc(
          "instance_places_restantes" as never,
          { p_instance_id: trajetInstanceId } as never,
        );
        if (!cancelled && !error && typeof data === "number") {
          setRestantes(data);
          prevRef.current = data;
        }
      } catch {
        // fallback silencieux
      }
    }

    void fetchInitial();

    const supabase = createClient();
    const channel = supabase
      .channel(`places-${trajetInstanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `trajet_instance_id=eq.${trajetInstanceId}`,
        },
        async () => {
          if (cancelled) return;
          try {
            const { data, error } = await supabase.rpc(
              "instance_places_restantes" as never,
              { p_instance_id: trajetInstanceId } as never,
            );
            if (cancelled || error) return;
            const next = typeof data === "number" ? data : placesTotal;
            if (next < prevRef.current) {
              setFlash(true);
              setTimeout(() => {
                if (!cancelled) setFlash(false);
              }, 800);
            }
            prevRef.current = next;
            setRestantes(next);
          } catch {
            // fallback silencieux
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [trajetInstanceId, placesTotal, initialPlacesRestantes]);

  const color = getPlacesColor(restantes);
  const label = getPlacesLabel(restantes, placesTotal);

  return (
    <span
      title="Mis à jour en temps réel"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${colorMap[color]} ${flash ? "animate-pulse" : ""}`}
    >
      <Users className="size-3 shrink-0" />
      {label}
    </span>
  );
}
