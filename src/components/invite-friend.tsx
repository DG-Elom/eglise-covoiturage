"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Share2, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  buildReferralMessage,
  buildWhatsAppShareUrl,
} from "@/lib/referral";

type ReferralInfo = {
  code: string;
  link: string;
  parrainages_reussis: number;
  ambassadeur: boolean;
};

export function InviteFriend({ prenom }: { prenom?: string }) {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referral")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((data: ReferralInfo) => {
        if (!cancelled) setInfo(data);
      })
      .catch(() => {
        if (!cancelled) setInfo(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyLink() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.link);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  }

  function shareWhatsApp() {
    if (!info) return;
    const message = buildReferralMessage(info.link, prenom);
    window.open(buildWhatsAppShareUrl(message), "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <Loader2 className="size-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
        Invitation indisponible pour le moment.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <UserPlus className="size-4 text-emerald-600 dark:text-emerald-400" />
          Inviter un ami
        </h2>
        {info.ambassadeur && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <Sparkles className="size-3" />
            Ambassadeur
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Partage ton lien : aide d&apos;autres fidèles à covoiturer pour aller au
        culte.
        {info.parrainages_reussis > 0 && (
          <>
            {" "}
            <span className="font-medium text-emerald-700 dark:text-emerald-300">
              {info.parrainages_reussis} ami
              {info.parrainages_reussis > 1 ? "s" : ""} déjà inscrit
              {info.parrainages_reussis > 1 ? "s" : ""} grâce à toi 🙌
            </span>
          </>
        )}
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition"
        >
          <Share2 className="size-4" />
          Inviter sur WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copié !" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
