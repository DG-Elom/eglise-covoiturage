"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, Sparkles, X } from "lucide-react";
import { confirmToast } from "@/lib/confirm";

const DEFAULT_BRIEF =
  "Encourager gentiment ce conducteur a publier un trajet pour le prochain culte";

export function SendSmsButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"generate" | "send" | null>(null);

  async function handleGenerate() {
    setLoading("generate");
    try {
      const res = await fetch("/api/admin/broadcast-sms/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brief: DEFAULT_BRIEF,
          ton: "encouragement",
          target_label: `${userName} (conducteur sans trajet actif)`,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok || !data.message) {
        toast.error(data.error ?? "Generation echouee");
        return;
      }
      setMessage(data.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleSend() {
    if (message.trim().length === 0) {
      toast.error("Le SMS est vide");
      return;
    }
    const ok = await confirmToast(`Envoyer ce SMS a ${userName} ?`, {
      confirmLabel: "Envoyer",
    });
    if (!ok) return;

    setLoading("send");
    try {
      const res = await fetch("/api/admin/broadcast-sms/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          filter: { type: "single", user_id: userId },
          message: message.trim(),
          ton: "encouragement",
        }),
      });
      const data = (await res.json()) as {
        n_envoyes?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Envoi echoue");
        return;
      }
      if (data.n_envoyes === 1) {
        toast.success(`SMS envoye a ${userName}`);
      } else {
        toast.error(
          "Pas envoye (numero invalide, opt-out, ou deja envoye recemment)",
        );
      }
      setOpen(false);
      setMessage("");
    } finally {
      setLoading(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <MessageSquare className="size-3.5" />
        SMS
      </button>
    );
  }

  const charCount = message.length;
  const overLimit = charCount > 160;

  return (
    <div className="absolute right-4 top-full z-10 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
          SMS pour {userName}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="size-4" />
        </button>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Tape ton message ou clique Suggerer"
        rows={3}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />

      <div className="mt-1 flex items-center justify-between text-[10px]">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading !== null}
          className="inline-flex items-center gap-1 text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-400"
        >
          {loading === "generate" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          Suggerer (IA)
        </button>
        <span className={overLimit ? "text-red-600" : "text-slate-400"}>
          {charCount}/160
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={loading !== null || message.trim().length === 0}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {loading === "send" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : null}
          Envoyer
        </button>
      </div>
    </div>
  );
}
