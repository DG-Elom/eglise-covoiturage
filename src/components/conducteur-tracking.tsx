"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function ConducteurTracking({
  trajetInstanceId,
}: {
  trajetInstanceId: string;
}) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  function stop() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setActive(false);
  }

  useEffect(() => stop, []);

  function start() {
    if (!navigator.geolocation) {
      toast.error("Géolocalisation non supportée");
      return;
    }
    setStarting(true);
    const supabase = createClient();
    const channel = supabase.channel(`trajet-${trajetInstanceId}`, {
      config: { broadcast: { self: false } },
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setStarting(false);
        setActive(true);
        toast.success("Position partagée avec les passagers");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setStarting(false);
        toast.error("Échec de la connexion temps réel");
        stop();
      }
    });
    channelRef.current = channel;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        channel.send({
          type: "broadcast",
          event: "pos",
          payload: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            ts: Date.now(),
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Autorise la géolocalisation pour partager ta position");
        } else {
          toast.error(`GPS: ${err.message}`);
        }
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  if (active) {
    return (
      <button
        type="button"
        onClick={stop}
        className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 transition dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
      >
        <span className="size-2 rounded-full bg-red-500 animate-pulse" />
        <Square className="size-3" />
        Arrêter le partage
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={starting}
      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
    >
      {starting ? <Loader2 className="size-3 animate-spin" /> : <MapPin className="size-3" />}
      Démarrer le trajet
    </button>
  );
}
