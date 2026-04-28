"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const url = "https://icc-covoit.fr";
  const text =
    "Allons à l'église ensemble ! Voici l'app de covoiturage entre fidèles ICC Metz :";

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Covoiturage ICC Metz", text, url });
        return;
      } catch {
        // user cancelled or unsupported, fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition"
    >
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copié !" : "Partager le lien"}
    </button>
  );
}
