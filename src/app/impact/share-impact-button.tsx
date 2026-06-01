"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";

export function ShareImpactButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const url = "https://icc-covoit.fr";
  const message = `${text}\n\nRejoins le covoiturage ICC Metz 👉 ${url}`;

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Notre impact — Covoiturage ICC Metz",
          text,
          url,
        });
        return;
      } catch {
        // annulé ou non supporté : on retombe sur la copie
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Carte d'impact copiée");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copié !" : "Partager notre impact"}
    </button>
  );
}
