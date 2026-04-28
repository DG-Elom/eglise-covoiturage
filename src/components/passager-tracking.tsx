"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation, Volume2, Clock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Map } from "@/components/map";
import { geocodeAddress } from "@/lib/mapbox";
import { haversineKm, etaMinutes, formatDistance, type LatLng } from "@/lib/distance";
import { SosButton } from "@/components/sos-button";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Pos = LatLng & { ts: number };

export function PassagerTracking({
  trajetInstanceId,
  pickupAdresse,
  emergencyName,
  emergencyPhone,
}: {
  trajetInstanceId: string;
  pickupAdresse: string;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
}) {
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [conducteurPos, setConducteurPos] = useState<Pos | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Geocode pickup address once
  useEffect(() => {
    let cancelled = false;
    geocodeAddress(pickupAdresse).then((results) => {
      if (cancelled) return;
      if (results.length > 0) {
        setPickup({ lat: results[0].lat, lng: results[0].lng });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pickupAdresse]);

  // Subscribe to realtime channel
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trajet-${trajetInstanceId}`)
      .on("broadcast", { event: "pos" }, (msg) => {
        const p = msg.payload as Pos;
        if (typeof p?.lat !== "number" || typeof p?.lng !== "number") return;
        setConducteurPos(p);
        setWaiting(false);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [trajetInstanceId]);

  const distanceKm =
    pickup && conducteurPos ? haversineKm(conducteurPos, pickup) : null;
  const eta = distanceKm !== null ? etaMinutes(distanceKm) : null;
  const isClose = eta !== null && eta <= 5;

  // Trigger alert (sound + vibrate) when conducteur is at most 5 min away
  useEffect(() => {
    if (!isClose) {
      if (eta !== null && eta > 7) alertedRef.current = false;
      return;
    }
    if (alertedRef.current) return;
    alertedRef.current = true;

    if (soundEnabled) {
      try {
        const ctx =
          audioCtxRef.current ??
          new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)();
        audioCtxRef.current = ctx;
        playBeep(ctx);
        setTimeout(() => playBeep(ctx), 700);
        setTimeout(() => playBeep(ctx), 1400);
      } catch {
        // ignore audio errors
      }
    }
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate([300, 150, 300, 150, 300]);
    }
  }, [isClose, eta, soundEnabled]);

  async function enableSound() {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      audioCtxRef.current = ctx;
      // Play a short silent beep to unlock audio on mobile
      playBeep(ctx, 200);
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(false);
    }
  }

  return (
    <div className="space-y-3">
      {isClose && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-900 animate-pulse dark:bg-red-950/40 dark:text-red-100">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-red-500 animate-ping" />
            <span className="font-semibold">
              Le conducteur arrive — {distanceKm !== null && formatDistance(distanceKm)} ·
              ~{eta} min
            </span>
          </div>
        </div>
      )}

      {waiting && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="size-3.5 animate-spin" />
          En attente du démarrage du conducteur…
        </div>
      )}

      {!waiting && conducteurPos && pickup && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Navigation className="size-4 text-emerald-600" />
              <strong>{distanceKm !== null && formatDistance(distanceKm)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock className="size-4" />
              ~{eta} min
            </span>
          </div>
          <Map
            center={[
              (pickup.lng + conducteurPos.lng) / 2,
              (pickup.lat + conducteurPos.lat) / 2,
            ]}
            zoom={13}
            markers={[
              {
                lat: pickup.lat,
                lng: pickup.lng,
                label: "Toi",
                color: "#0ea5e9",
              },
              {
                lat: conducteurPos.lat,
                lng: conducteurPos.lng,
                label: "Conducteur",
                color: "#10b981",
              },
            ]}
            className="h-56 w-full rounded-lg overflow-hidden"
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!soundEnabled ? (
          <button
            type="button"
            onClick={enableSound}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50 transition dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <Volume2 className="size-3" />
            Activer l&apos;alerte sonore
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-500">
            <Volume2 className="size-3 text-emerald-600" />
            Alerte sonore activée
          </span>
        )}
        <SosButton emergencyName={emergencyName} emergencyPhone={emergencyPhone} />
      </div>
    </div>
  );
}

function playBeep(ctx: AudioContext, durationMs = 350) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000);
  osc.start();
  osc.stop(ctx.currentTime + durationMs / 1000);
}
